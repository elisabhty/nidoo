-- Widgets de l'écran d'accueil.
-- Chaque téléphone reçoit une « clé widget » : avec elle, les widgets lisent l'essentiel de la maison et agissent
-- (un bisou, une tâche cochée, un coup au morpion) sans ouvrir l'appli. La session du compte reste dans l'appli :
-- les widgets n'y touchent jamais (un compte invisible dont la session se perd, c'est une famille perdue).
-- Seule l'empreinte de la clé est gardée ; la clé ne donne accès qu'à ce qui suit, pour une seule maison.

create table private.widget_keys (
  key_hash bytea primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index widget_keys_member_idx on private.widget_keys (member_id, created_at desc);
create index widget_keys_family_idx on private.widget_keys (family_id);
create index widget_keys_user_idx on private.widget_keys (user_id);
alter table private.widget_keys enable row level security;
revoke all on private.widget_keys from public, anon, authenticated;

-- L'appli demande une clé pour ce téléphone (une fois, puis elle la garde).
create function public.widget_cle(p_family uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid := private.my_member(p_family);
  cle text;
begin
  if uid is null or mid is null then raise exception 'PAS_MEMBRE'; end if;
  cle := 'nw_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into private.widget_keys (key_hash, user_id, family_id, member_id)
    values (sha256(convert_to(cle, 'UTF8')), uid, p_family, mid);
  -- au plus 4 clés par personne et par maison (téléphone, tablette, réinstallation…) : les plus anciennes s'en vont
  delete from private.widget_keys w
    where w.member_id = mid
      and w.key_hash not in (
        select w2.key_hash from private.widget_keys w2 where w2.member_id = mid order by w2.created_at desc limit 4
      );
  return cle;
end;
$$;

-- À qui est cette clé ?
create function private.widget_qui(p_key text) returns private.widget_keys
language plpgsql security definer set search_path = '' as $$
declare
  k private.widget_keys;
begin
  if p_key is null or char_length(p_key) <> 67 then raise exception 'CLE_INCONNUE'; end if;
  select * into k from private.widget_keys w where w.key_hash = sha256(convert_to(p_key, 'UTF8'));
  if not found then raise exception 'CLE_INCONNUE'; end if;
  if k.last_used_at is null or k.last_used_at < now() - interval '1 hour' then
    update private.widget_keys set last_used_at = now() where key_hash = k.key_hash;
  end if;
  return k;
end;
$$;

-- Ce que montrent les widgets : la famille, les humeurs du jour, les dernières attentions, les prochaines dates,
-- ce qu'il reste à faire, les parties en cours, le compagnon et le dernier sondage.
create function private.widget_etat(p_family uuid, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with jour as (select (now() at time zone 'Europe/Paris')::date as d),
  ev as (
    select e.id, e.title, e.kind, e.sticker, e.all_day, e.yearly, e.weekly, e.lieu,
      (e.starts_at at time zone 'Europe/Paris') as debut,
      greatest(0, coalesce(e.ends_on - (e.starts_at at time zone 'Europe/Paris')::date, 0)) as duree
    from public.events e
    where e.family_id = p_family
  ),
  -- la prochaine fois (ou celle en cours) : un anniversaire revient chaque année, une activité chaque semaine
  ev2 as (
    select ev.*,
      case
        when ev.yearly then (ev.debut::date + make_interval(years => extract(year from j.d)::int - extract(year from ev.debut)::int))::date
        when ev.weekly and ev.debut::date < j.d then ev.debut::date + ((j.d - ev.debut::date) - (j.d - ev.debut::date) % 7)
        else ev.debut::date
      end as n0
    from ev, jour j
  ),
  ev3 as (
    select ev2.*,
      case
        when ev2.yearly and ev2.n0 + ev2.duree < j.d then (ev2.n0 + interval '1 year')::date
        when ev2.weekly and not ev2.yearly and ev2.n0 + ev2.duree < j.d then ev2.n0 + 7
        else ev2.n0
      end as n
    from ev2, jour j
  )
  select jsonb_build_object(
    'v', 1,
    'maintenant', now(),
    'jour', (select d from jour),
    'moi', p_me,
    'famille', (select jsonb_build_object('id', f.id, 'n', f.name, 'm', f.house_type, 'e', f.stars) from public.families f where f.id = p_family),
    'membres', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'n', m.display_name, 'a', m.avatar, 'c', m.color,
        'h', case when (m.mood_at at time zone 'Europe/Paris')::date = (select d from jour) then m.mood end,
        'tel', m.user_id is not null
      ) order by m.joined_at), '[]'::jsonb)
      from public.members m where m.family_id = p_family
    ),
    'recues', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'de', t.from_member, 'k', t.kind, 'm', t.message, 'q', t.created_at, 'vu', t.seen_at is not null) order by t.created_at desc), '[]'::jsonb)
      from (select * from public.thoughts t where t.to_member = p_me order by t.created_at desc limit 8) t
    ),
    'envoyees', (
      select coalesce(jsonb_agg(jsonb_build_object('a', t.to_member, 'k', t.kind, 'q', t.created_at) order by t.created_at desc), '[]'::jsonb)
      from (select * from public.thoughts t where t.family_id = p_family and t.from_member = p_me order by t.created_at desc limit 6) t
    ),
    'recues_jour', (
      select count(*) from public.thoughts t
      where t.to_member = p_me and (t.created_at at time zone 'Europe/Paris')::date = (select d from jour)
    ),
    'dates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 't', x.title, 'k', x.kind, 's', x.sticker, 'j', x.n, 'f', x.n + x.duree,
        'h', case when x.all_day then null else to_char(x.debut, 'HH24:MI') end,
        'l', x.lieu, 'an', x.yearly
      ) order by x.n, x.debut::time, x.title), '[]'::jsonb)
      from (
        select * from ev3 where ev3.n + ev3.duree >= (select d from jour)
        order by ev3.n, ev3.debut::time, ev3.title limit 8
      ) x
    ),
    'liste', (
      select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'k', i.kind, 't', i.title, 'p', i.assigned_to) order by i.created_at), '[]'::jsonb)
      from (select * from public.list_items i where i.family_id = p_family and not i.done order by i.created_at limit 40) i
    ),
    'parties', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'k', g.kind, 'p1', g.p1, 'p2', g.p2, 'tour', g.turn, 'fini', g.status = 'fini', 'gagne', g.winner,
        'g', g.state -> 'g', 'der', g.state -> 'last', 'ligne', g.state -> 'line', 'q', g.updated_at
      ) order by g.updated_at desc), '[]'::jsonb)
      from (
        select * from public.games g
        where g.family_id = p_family and p_me in (g.p1, g.p2) and g.kind in ('morpion', 'puissance4')
          and (g.status = 'en_cours' or g.updated_at > now() - interval '1 day')
        order by g.updated_at desc limit 6
      ) g
    ),
    'compagnon', (
      select jsonb_build_object(
        'e', p.species, 'n', p.name, 'a', p.love, 'tenue', p.outfit,
        'friandises', coalesce((select s.qty from public.family_stock s where s.family_id = p_family and s.item_key = 'friandises'), 0)
      )
      from public.pets p where p.family_id = p_family
    ),
    'sondage', (
      select jsonb_build_object(
        'id', mo.id, 'q', mo.body, 'de', mo.member_id, 'choix', to_jsonb(mo.poll_options),
        'voix', (
          select coalesce(jsonb_agg((select count(*) from public.poll_votes v where v.moment_id = mo.id and v.option_index = o.i - 1) order by o.i), '[]'::jsonb)
          from generate_subscripts(mo.poll_options, 1) as o(i)
        ),
        'moi', (select v.option_index from public.poll_votes v where v.moment_id = mo.id and v.member_id = p_me)
      )
      from public.moments mo
      where mo.family_id = p_family and mo.poll_options is not null and mo.created_at > now() - interval '7 days'
      order by mo.created_at desc limit 1
    )
  );
$$;

create function public.widget_etat(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k private.widget_keys := private.widget_qui(p_key);
begin
  return private.widget_etat(k.family_id, k.member_id);
end;
$$;

-- Un bouton d'un widget : l'action, puis l'état à jour (le widget se redessine avec).
create function public.widget_agir(p_key text, p_action text, p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k private.widget_keys := private.widget_qui(p_key);
  a jsonb := coalesce(p_args, '{}'::jsonb);
  v_id uuid;
  v_txt text;
  v_n int;
  v_fait boolean;
begin
  -- Les fonctions de l'appli (jouer un coup, donner une friandise…) reconnaissent la personne à son compte :
  -- le temps de cet appel, et de lui seul, on est cette personne.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', k.user_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', k.user_id::text, true);

  if p_action = 'attention' then
    v_id := (a ->> 'a')::uuid;
    v_txt := a ->> 'k';
    if v_txt is null or v_txt not in ('coeur', 'calin', 'courage', 'bisou') then raise exception 'ATTENTION_INCONNUE'; end if;
    if v_id is null or v_id = k.member_id
       or not exists (select 1 from public.members m where m.id = v_id and m.family_id = k.family_id) then
      raise exception 'PROCHE_INCONNU';
    end if;
    -- un bouton sous le pouce d'un enfant : pas plus de 20 attentions en dix minutes
    if (select count(*) from public.thoughts t
        where t.family_id = k.family_id and t.from_member = k.member_id and t.created_at > now() - interval '10 minutes') >= 20 then
      raise exception 'DOUCEMENT';
    end if;
    insert into public.thoughts (family_id, from_member, to_member, kind) values (k.family_id, k.member_id, v_id, v_txt);

  elsif p_action = 'tache' then
    v_fait := coalesce((a ->> 'fait')::boolean, true);
    update public.list_items i
      set done = v_fait, done_by = case when v_fait then k.member_id end
      where i.id = (a ->> 'id')::uuid and i.family_id = k.family_id;
    if not found then raise exception 'TACHE_INCONNUE'; end if;

  elsif p_action = 'humeur' then
    v_txt := a ->> 'h';
    if v_txt is not null and v_txt not in ('heureux', 'serein', 'motive', 'fete', 'fatigue', 'stresse', 'nostalgique', 'triste') then
      raise exception 'HUMEUR_INCONNUE';
    end if;
    -- la même humeur qu'hier : on la repose, pour qu'elle soit bien celle d'aujourd'hui
    if v_txt is not null and exists (
      select 1 from public.members m
      where m.id = k.member_id and m.mood = v_txt
        and (m.mood_at at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
    ) then
      update public.members set mood = null, mood_note = null where id = k.member_id;
    end if;
    update public.members set mood = v_txt, mood_note = null where id = k.member_id;

  elsif p_action = 'jeu_lancer' then
    v_txt := a ->> 'k';
    if v_txt is null or v_txt not in ('morpion', 'puissance4') then raise exception 'JEU_INCONNU'; end if;
    perform public.start_game(k.family_id, v_txt, (a ->> 'a')::uuid, null);

  elsif p_action = 'jeu_coup' then
    v_id := (a ->> 'id')::uuid;
    if not exists (select 1 from public.games g where g.id = v_id and g.family_id = k.family_id) then raise exception 'PARTIE_INCONNUE'; end if;
    perform public.play_game(v_id, (a ->> 'c')::int);

  elsif p_action = 'friandise' then
    perform public.give_treat(k.family_id);

  elsif p_action = 'vote' then
    v_id := (a ->> 'id')::uuid;
    v_n := (a ->> 'c')::int;
    if v_n is null or not exists (
      select 1 from public.moments mo
      where mo.id = v_id and mo.family_id = k.family_id and mo.poll_options is not null
        and v_n between 0 and array_length(mo.poll_options, 1) - 1
    ) then
      raise exception 'SONDAGE_INVALIDE';
    end if;
    insert into public.poll_votes (moment_id, family_id, member_id, option_index) values (v_id, k.family_id, k.member_id, v_n)
      on conflict (moment_id, member_id) do update set option_index = excluded.option_index;

  else
    raise exception 'ACTION_INCONNUE';
  end if;

  return private.widget_etat(k.family_id, k.member_id);
end;
$$;

revoke execute on function private.widget_qui(text), private.widget_etat(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.widget_cle(uuid), public.widget_etat(text), public.widget_agir(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.widget_cle(uuid) to authenticated;
-- le widget n'a pas de session : il se présente avec sa clé
grant execute on function public.widget_etat(text), public.widget_agir(text, text, jsonb) to anon, authenticated;
