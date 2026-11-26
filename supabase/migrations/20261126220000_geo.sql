-- « Où sont mes proches ? », la suite (Elisa, 26 novembre : « la partie géo, je suis en route et tout ») :
--   - partager pour un temps (une heure, jusqu'à ce soir) : passé l'heure, plus personne ne voit la position, et
--     le téléphone arrête de l'envoyer (widget_position lui répond 0) ;
--   - une position approximative : la ville, à 1 km près, sans la rue ni le nom d'un de nos lieux ;
--   - « Bien arrivé ! » : si on l'a choisi, un petit mot à ses proches quand on arrive à un de nos lieux ;
--   - « Je suis en route » depuis le widget (widget_agir, action en_route) : un petit mot à chacun de ses proches.
-- Toujours une seule ligne par membre, jamais d'historique des déplacements. Demande 20261126013000_endroits.sql.

alter table public.positions
  add column jusqua timestamptz,
  add column approx boolean not null default false,
  add column prevenir boolean not null default false;

-- un partage pour un temps, fini : plus personne ne le voit (la ligne part au prochain passage du téléphone)
drop policy positions_select on public.positions;
create policy positions_select on public.positions for select to authenticated
  using (private.is_member(family_id) and (jusqua is null or jusqua > now()));

-- Le dernier de nos lieux où chacun se trouvait, pour savoir quand il y arrive. À part (schéma privé) : même en
-- position approximative, il ne se lit nulle part.
create table private.lieux_actuels (
  member_id uuid primary key references public.members (id) on delete cascade,
  endroit_id uuid references public.endroits (id) on delete set null,
  depuis timestamptz not null default now()
);
revoke all on private.lieux_actuels from public, anon, authenticated;

drop function public.position_partager(uuid, double precision, double precision, integer, text, text, integer);
drop function private.position_ecrire(uuid, uuid, double precision, double precision, integer, text, text, integer);

-- Écrire la position d'un membre. Les réglages (p_reglages) viennent de l'appli quand on commence à partager :
-- {"jusqua": "…" ou null, "approx": true, "prevenir": true} ; une clé absente garde le réglage d'avant.
-- Renvoie faux si le partage pour un temps est fini (la ligne s'en va) et qu'on ne repart pas avec de nouveaux réglages.
create function private.position_ecrire(p_member uuid, p_family uuid, p_lat double precision, p_lon double precision,
  p_precision integer, p_lieu text, p_ville text, p_batterie integer, p_reglages jsonb default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  avant public.positions;
  existait boolean;
  v_jusqua timestamptz;
  v_approx boolean;
  v_prevenir boolean;
  v_lat double precision;
  v_lon double precision;
  v_precision integer;
  v_lieu text;
  v_endroit uuid;
  v_nom text;
  v_connu boolean;
  v_avant uuid;
  v_mot text;
begin
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'POSITION_INVALIDE';
  end if;
  select * into avant from public.positions where member_id = p_member for update;
  existait := found;
  -- partagée pour un temps, et l'heure est passée : le partage s'arrête (sauf si l'on repart, avec ses réglages)
  if existait and avant.jusqua is not null and avant.jusqua <= now() then
    delete from public.positions where member_id = p_member;
    delete from private.lieux_actuels where member_id = p_member;
    if p_reglages is null then return false; end if;
    existait := false;
  end if;

  v_jusqua := case when p_reglages ? 'jusqua' then (p_reglages ->> 'jusqua')::timestamptz when existait then avant.jusqua end;
  v_approx := case when p_reglages ? 'approx' then coalesce((p_reglages ->> 'approx')::boolean, false) else existait and avant.approx end;
  v_prevenir := case when p_reglages ? 'prevenir' then coalesce((p_reglages ->> 'prevenir')::boolean, false) else existait and avant.prevenir end;
  if v_jusqua is not null and (v_jusqua <= now() or v_jusqua > now() + interval '25 hours') then
    raise exception 'DUREE_INVALIDE';
  end if;

  v_precision := case when p_precision between 0 and 100000 then p_precision end;
  v_lieu := nullif(left(btrim(coalesce(p_lieu, '')), 120), '');
  if v_approx then
    -- la ville, à 1 km près : ni la rue, ni le point exact
    v_lat := round(p_lat::numeric, 2)::double precision;
    v_lon := round(p_lon::numeric, 2)::double precision;
    v_precision := greatest(coalesce(v_precision, 0), 1000);
    v_lieu := null;
  else
    v_lat := round(p_lat::numeric, 5)::double precision;
    v_lon := round(p_lon::numeric, 5)::double precision;
  end if;

  insert into public.positions as p (member_id, family_id, lat, lon, precision_m, lieu, ville, batterie, updated_at, jusqua, approx, prevenir)
  values (
    p_member, p_family, v_lat, v_lon, v_precision, v_lieu, nullif(left(btrim(coalesce(p_ville, '')), 80), ''),
    case when p_batterie between 0 and 100 then p_batterie end, now(), v_jusqua, v_approx, v_prevenir
  )
  on conflict (member_id) do update set
    lat = excluded.lat, lon = excluded.lon, precision_m = excluded.precision_m, lieu = excluded.lieu, ville = excluded.ville,
    batterie = coalesce(excluded.batterie, p.batterie), updated_at = now(),
    jusqua = excluded.jusqua, approx = excluded.approx, prevenir = excluded.prevenir;

  -- à un de nos lieux ? Le plus proche dont on est dans le rayon (la même règle que l'appli et les widgets), au point
  -- exact ; gardé à part pour savoir, au passage suivant, si l'on vient d'y arriver
  select x.id, x.nom into v_endroit, v_nom from public.endroits x
    where x.family_id = p_family
      and private.metres(p_lat, p_lon, x.lat, x.lon) <= x.rayon_m + least(greatest(coalesce(p_precision, 0), 0), 200)
    order by private.metres(p_lat, p_lon, x.lat, x.lon)
    limit 1;
  select l.endroit_id into v_avant from private.lieux_actuels l where l.member_id = p_member;
  v_connu := found;
  insert into private.lieux_actuels as l (member_id, endroit_id, depuis) values (p_member, v_endroit, now())
    on conflict (member_id) do update set endroit_id = excluded.endroit_id,
      depuis = case when l.endroit_id is distinct from excluded.endroit_id then now() else l.depuis end;

  -- « Bien arrivé ! » : on vient d'arriver à un de nos lieux (on n'y était pas au passage d'avant), on a choisi de
  -- prévenir, et l'on ne cache pas où l'on est ; pas deux fois le même petit mot dans la demi-heure (le téléphone qui
  -- hésite au bord de la zone)
  if v_prevenir and not v_approx and v_connu and p_reglages is null and v_endroit is not null and v_avant is distinct from v_endroit then
    v_mot := '📍 ' || v_nom || chr(160) || ': je viens d’arriver' || chr(160) || '✅';
    if not exists (
      select 1 from public.thoughts t
      where t.from_member = p_member and t.message = v_mot and t.created_at > now() - interval '30 minutes'
    ) then
      insert into public.thoughts (family_id, from_member, to_member, kind, message)
      select p_family, p_member, m.id, 'mot', v_mot
      from public.members m
      where m.family_id = p_family and m.id <> p_member and m.user_id is not null;
    end if;
  end if;
  return true;
end;
$$;

-- L'appli : je partage ma position avec cette famille (la première fois, ou quand l'appli est ouverte). Avec
-- p_reglages : je commence (ou recommence) à partager, avec ces réglages.
create function public.position_partager(p_family uuid, p_lat double precision, p_lon double precision,
  p_precision integer default null, p_lieu text default null, p_ville text default null, p_batterie integer default null,
  p_reglages jsonb default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  return private.position_ecrire(mid, p_family, p_lat, p_lon, p_precision, p_lieu, p_ville, p_batterie, p_reglages);
end;
$$;

-- L'appli : changer les réglages de mon partage (pour combien de temps, approximative, « Bien arrivé ! »).
-- Approximative : le point déjà partagé s'arrondit tout de suite, et la rue s'efface.
create function public.position_reglages(p_family uuid, p_reglages jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  avant public.positions;
  v_jusqua timestamptz;
  v_approx boolean;
  v_prevenir boolean;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  select * into avant from public.positions where member_id = mid for update;
  if not found or (avant.jusqua is not null and avant.jusqua <= now()) then raise exception 'PAS_PARTAGE'; end if;
  v_jusqua := case when p_reglages ? 'jusqua' then (p_reglages ->> 'jusqua')::timestamptz else avant.jusqua end;
  v_approx := case when p_reglages ? 'approx' then coalesce((p_reglages ->> 'approx')::boolean, false) else avant.approx end;
  v_prevenir := case when p_reglages ? 'prevenir' then coalesce((p_reglages ->> 'prevenir')::boolean, false) else avant.prevenir end;
  if v_jusqua is not null and (v_jusqua <= now() or v_jusqua > now() + interval '25 hours') then
    raise exception 'DUREE_INVALIDE';
  end if;
  update public.positions set
    jusqua = v_jusqua, approx = v_approx, prevenir = v_prevenir,
    lat = case when v_approx then round(lat::numeric, 2)::double precision else lat end,
    lon = case when v_approx then round(lon::numeric, 2)::double precision else lon end,
    lieu = case when v_approx then null else lieu end,
    precision_m = case when v_approx then greatest(coalesce(precision_m, 0), 1000) else precision_m end
  where member_id = mid;
end;
$$;

-- L'appli : je ne partage plus ma position avec cette famille (elle disparaît tout de suite).
create or replace function public.position_arreter(p_family uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  delete from public.positions where member_id = mid;
  delete from private.lieux_actuels where member_id = mid;
end;
$$;

-- L'iPhone, en arrière-plan, avec la clé widget : la nouvelle position va à chaque maison où la personne la partage
-- encore. Renvoie le nombre de maisons mises à jour (0 : plus rien à partager, le téléphone arrête de suivre).
create or replace function public.widget_position(p_key text, p_lat double precision, p_lon double precision,
  p_precision integer default null, p_lieu text default null, p_ville text default null, p_batterie integer default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  k private.widget_keys := private.widget_qui(p_key);
  r record;
  n integer := 0;
begin
  for r in
    select p.member_id, p.family_id from public.positions p
    join public.members m on m.id = p.member_id
    where m.user_id = k.user_id
  loop
    if private.position_ecrire(r.member_id, r.family_id, p_lat, p_lon, p_precision, p_lieu, p_ville, p_batterie) then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Les widgets « Où sont mes proches ? » : seulement les partages en cours ; « j » (jusqu'à quand) et « a »
-- (approximative) en plus ; jamais le nom d'un de nos lieux pour une position approximative. « en_route » : le
-- serveur sait faire « Je suis en route » (le widget n'en montre le bouton qu'alors).
create or replace function private.widget_etat(p_family uuid, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.widget_etat_base(p_family, p_me) || jsonb_build_object('en_route', true, 'positions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.member_id, 'la', p.lat, 'lo', p.lon, 'p', p.precision_m,
      'l', coalesce(e.nom, p.lieu), 'v', case when e.nom is null then p.ville end,
      'b', p.batterie, 'q', p.updated_at, 'j', p.jusqua, 'a', p.approx
    ) order by p.updated_at desc), '[]'::jsonb)
    from public.positions p
    left join lateral (
      select x.nom from public.endroits x
      where not p.approx and x.family_id = p.family_id
        and private.metres(p.lat, p.lon, x.lat, x.lon) <= x.rayon_m + least(greatest(coalesce(p.precision_m, 0), 0), 200)
      order by private.metres(p.lat, p.lon, x.lat, x.lon)
      limit 1
    ) e on true
    where p.family_id = p_family and (p.jusqua is null or p.jusqua > now())
  ));
$$;

-- Un bouton d'un widget : l'action, puis l'état à jour (le widget se redessine avec). Comme avant, plus « en_route ».
create or replace function public.widget_agir(p_key text, p_action text, p_args jsonb default '{}'::jsonb) returns jsonb
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

  elsif p_action = 'en_route' then
    -- « Je suis en route » : le même petit mot à chacun de ses proches qui a un téléphone (le widget l'écrit, avec
    -- l'heure d'arrivée s'il la connaît ; sinon « Je suis en route 🚗 »)
    v_txt := left(btrim(coalesce(a ->> 'm', '')), 140);
    if v_txt = '' then v_txt := 'Je suis en route' || chr(160) || '🚗'; end if;
    if (select count(*) from public.thoughts t
        where t.family_id = k.family_id and t.from_member = k.member_id and t.created_at > now() - interval '10 minutes') >= 20 then
      raise exception 'DOUCEMENT';
    end if;
    insert into public.thoughts (family_id, from_member, to_member, kind, message)
    select k.family_id, k.member_id, m.id, 'mot', v_txt
    from public.members m
    where m.family_id = k.family_id and m.id <> k.member_id and m.user_id is not null;
    if not found then raise exception 'PERSONNE_A_PREVENIR'; end if;

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

revoke execute on function private.position_ecrire(uuid, uuid, double precision, double precision, integer, text, text, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.position_partager(uuid, double precision, double precision, integer, text, text, integer, jsonb),
  public.position_reglages(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.position_partager(uuid, double precision, double precision, integer, text, text, integer, jsonb),
  public.position_reglages(uuid, jsonb) to authenticated;
