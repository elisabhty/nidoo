-- NIDOO — La tour : chacun son tour, on lâche une forme en feutrine sur la tour ; celui qui fait tomber
-- une pièce a perdu. De 2 à 15 joueurs (toute la famille).
-- La physique tourne dans le téléphone de celui qui joue : il envoie la tour une fois posée. La base vérifie
-- que c'est bien son tour, que c'est la forme qu'elle lui a donnée, que la tour a exactement une pièce de plus
-- (des nombres raisonnables), puis tire au hasard la forme du suivant. Les formes (9) sont dans src/lib/tour.ts.

alter table public.parties drop constraint parties_kind_check;
alter table public.parties add constraint parties_kind_check check (kind in ('bataille', 'quidenous', 'dessin', 'annee', 'telephone', 'tour'));
alter table public.parties drop constraint parties_players_check;
alter table public.parties add constraint parties_players_check check (cardinality(players) between 2 and 15);

/** Poser une pièce : {t: 'pose', k: forme, tas: [[x, y, angle]… une par pièce, la nouvelle à la fin], tombe: bool}. */
create function private.act_tour(pa public.parties, me uuid, side int, a jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  pieces jsonb := coalesce(pa.state -> 'pieces', '[]'::jsonb);
  n int := jsonb_array_length(coalesce(pa.state -> 'pieces', '[]'::jsonb));
  tas jsonb := a -> 'tas';
  nb int := cardinality(pa.players);
  nouvelles jsonb := '[]';
  p jsonb;
  x uuid;
  i int;
begin
  if a ->> 't' is distinct from 'pose' then raise exception 'COUP_INTERDIT'; end if;
  if pa.turn is distinct from me then raise exception 'PAS_TON_TOUR'; end if;
  if jsonb_typeof(a -> 'k') <> 'number' or (a ->> 'k')::numeric is distinct from (st ->> 'prochaine')::numeric then raise exception 'COUP_INTERDIT'; end if;
  if jsonb_typeof(a -> 'tombe') is distinct from 'boolean' then raise exception 'COUP_INTERDIT'; end if;
  if jsonb_typeof(tas) is distinct from 'array' or jsonb_array_length(tas) <> n + 1 or n >= 400 then raise exception 'COUP_INTERDIT'; end if;
  for i in 0..n loop
    p := tas -> i;
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 3
       or exists (select 1 from jsonb_array_elements(p) v where case when jsonb_typeof(v) = 'number' then abs(v::numeric) > 100000 else true end) then
      raise exception 'COUP_INTERDIT';
    end if;
    nouvelles := nouvelles || jsonb_build_array(jsonb_build_object(
      'k', case when i < n then (pieces -> i ->> 'k')::int else (st ->> 'prochaine')::int end,
      'par', case when i < n then pieces -> i ->> 'par' else me::text end,
      'x', round((p ->> 0)::numeric, 2),
      'y', round((p ->> 1)::numeric, 2),
      'a', round((p ->> 2)::numeric, 4)));
  end loop;
  st := st || jsonb_build_object('pieces', nouvelles, 'dernier', me, 'prochaine', floor(random() * 9)::int);
  if (a ->> 'tombe')::boolean then
    -- la tour est tombée : celui qui vient de jouer a perdu ; les autres ont tenu bon
    st := st || jsonb_build_object('tombe', true, 'perdant', me);
    update public.parties
      set state = st, status = 'fini', turn = null, updated_at = now(),
          winner = case when nb = 2 then (select y from unnest(pa.players) y where y <> me limit 1) end
      where id = pa.id;
    foreach x in array pa.players loop
      if x <> me then perform private.award(pa.family_id, x, 'tour', 1, 5); end if;
    end loop;
    return jsonb_build_object('fini', true);
  end if;
  update public.parties set state = st, turn = pa.players[(side % nb) + 1], updated_at = now() where id = pa.id;
  return jsonb_build_object('fini', false);
end;
$$;

create or replace function public.start_partie(p_family uuid, p_kind text, p_players uuid[], p_setup jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  pl uuid[];
  x uuid;
  n int;
  pid uuid;
  st jsonb;
  sec jsonb := '{}';
  tour uuid;
  photos text[];
  an int := extract(year from now())::int;
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  if p_kind not in ('bataille', 'quidenous', 'dessin', 'annee', 'telephone', 'tour') then raise exception 'JEU_INCONNU'; end if;
  pl := array[me];
  foreach x in array coalesce(p_players, '{}') loop
    if x is not null and not x = any (pl) then pl := pl || x; end if;
  end loop;
  if exists (
    select 1 from unnest(pl) y
    where not exists (select 1 from public.members m where m.id = y and m.family_id = p_family and m.user_id is not null)
  ) then
    raise exception 'ADVERSAIRE_INCONNU';
  end if;
  n := cardinality(pl);
  if (p_kind in ('bataille', 'dessin') and n <> 2)
     or (p_kind in ('quidenous', 'annee') and n not between 2 and 8)
     or (p_kind = 'telephone' and n not between 3 and 8)
     or (p_kind = 'tour' and n not between 2 and 15) then
    raise exception 'JOUEURS';
  end if;
  if (select count(*) from public.parties p where p.family_id = p_family and p.status = 'en_cours') >= 40 then
    raise exception 'TROP_DE_PARTIES';
  end if;

  if p_kind = 'bataille' then
    st := jsonb_build_object('phase', 'placement', 'pret', '[false, false]'::jsonb,
      'b1', (select jsonb_agg(0) from generate_series(1, 64)), 'b2', (select jsonb_agg(0) from generate_series(1, 64)),
      's1', '[]'::jsonb, 's2', '[]'::jsonb);
    sec := jsonb_build_object('f1', private.bataille_flotte(), 'f2', private.bataille_flotte());
  elsif p_kind = 'quidenous' then
    if jsonb_typeof(p_setup -> 'q') <> 'array' or jsonb_array_length(p_setup -> 'q') not between 3 and 15
       or exists (select 1 from jsonb_array_elements(p_setup -> 'q') q where jsonb_typeof(q) <> 'number' or q::int not between 0 and 299) then
      raise exception 'COUP_INTERDIT';
    end if;
    st := jsonb_build_object('q', p_setup -> 'q', 'i', 0, 'votes', '[]'::jsonb, 'rondes', '[]'::jsonb, 'accords', 0);
    sec := jsonb_build_object('votes', '{}'::jsonb);
  elsif p_kind = 'dessin' then
    st := jsonb_build_object('n', 4, 'i', 0, 'phase', 'dessin', 'dessin', null, 'essais', '[]'::jsonb, 'rondes', '[]'::jsonb, 'trouves', 0);
    sec := jsonb_build_object('mot', private.mot_au_hasard());
    tour := me;
  elsif p_kind = 'annee' then
    select array_agg(v order by o) into photos from jsonb_array_elements_text(p_setup -> 'photos') with ordinality t(v, o);
    if coalesce(cardinality(photos), 0) not between 1 and 5
       or jsonb_typeof(p_setup -> 'annees') <> 'array' or jsonb_array_length(p_setup -> 'annees') <> cardinality(photos)
       or exists (select 1 from jsonb_array_elements(p_setup -> 'annees') y where jsonb_typeof(y) <> 'number' or y::int not between 1850 and an) then
      raise exception 'ANNEE_INVALIDE';
    end if;
    if (select count(*) from storage.objects o
        where o.bucket_id = 'jeux' and o.name = any (photos) and o.name like p_family::text || '/%') <> cardinality(photos) then
      raise exception 'PHOTO_INCONNUE';
    end if;
    st := jsonb_build_object('photos', to_jsonb(photos), 'fait', '[]'::jsonb);
    sec := jsonb_build_object('annees', p_setup -> 'annees', 'reponses', '{}'::jsonb);
  elsif p_kind = 'tour' then
    -- la tour est vide ; celui qui lance commence, avec une forme tirée au hasard
    st := jsonb_build_object('pieces', '[]'::jsonb, 'prochaine', floor(random() * 9)::int);
    tour := me;
  else
    st := jsonb_build_object('avance', (select jsonb_agg(0) from generate_series(1, n)));
    sec := jsonb_build_object('carnets', (select jsonb_agg('[]'::jsonb) from generate_series(1, n)));
  end if;

  insert into public.parties (family_id, kind, players, turn, state) values (p_family, p_kind, pl, tour, st) returning id into pid;
  insert into private.partie_secrets (partie_id, data) values (pid, sec);
  return pid;
end;
$$;

create or replace function public.act_partie(p_partie uuid, p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pa public.parties%rowtype;
  sec jsonb;
  me uuid;
  side int;
begin
  select * into pa from public.parties where id = p_partie for update;
  if not found then raise exception 'PARTIE_INCONNUE'; end if;
  me := private.my_member(pa.family_id);
  side := array_position(pa.players, me);
  if me is null or side is null then raise exception 'PAS_JOUEUR'; end if;
  if pa.status <> 'en_cours' then raise exception 'PARTIE_FINIE'; end if;
  select data into sec from private.partie_secrets where partie_id = pa.id for update;
  return case pa.kind
    when 'bataille' then private.act_bataille(pa, sec, me, side, p_action)
    when 'quidenous' then private.act_quidenous(pa, sec, me, p_action)
    when 'dessin' then private.act_dessin(pa, sec, me, side, p_action)
    when 'annee' then private.act_annee(pa, sec, me, side, p_action)
    when 'tour' then private.act_tour(pa, me, side, p_action)
    else private.act_telephone(pa, sec, me, side, p_action)
  end;
end;
$$;

create or replace function public.secret_partie(p_partie uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pa public.parties%rowtype;
  sec jsonb;
  me uuid;
  side int;
  n int;
  k int;
  j int;
  etapes jsonb := '[]';
begin
  select * into pa from public.parties where id = p_partie;
  if not found then raise exception 'PARTIE_INCONNUE'; end if;
  me := private.my_member(pa.family_id);
  side := array_position(pa.players, me);
  if me is null or side is null then return '{}'; end if;
  select data into sec from private.partie_secrets where partie_id = pa.id;
  n := cardinality(pa.players);
  if pa.kind = 'bataille' then
    return jsonb_build_object('flotte', sec -> ('f' || side));
  elsif pa.kind = 'quidenous' then
    return jsonb_build_object('vote', sec -> 'votes' -> me::text);
  elsif pa.kind = 'dessin' then
    if pa.status = 'en_cours' and pa.state ->> 'phase' = 'dessin' and pa.turn = me then
      return jsonb_build_object('mot', sec ->> 'mot');
    end if;
    return '{}';
  elsif pa.kind = 'tour' then
    return '{}';
  elsif pa.kind = 'annee' then
    if side = 1 then return jsonb_build_object('annees', sec -> 'annees'); end if;
    return jsonb_build_object('mes', sec -> 'reponses' -> me::text);
  end if;
  if pa.status <> 'en_cours' then return '{}'; end if;
  for k in 0..n - 1 loop
    j := (pa.state -> 'avance' ->> k)::int;
    if j < n and pa.players[((k + j) % n) + 1] = me then
      etapes := etapes || jsonb_build_array(jsonb_build_object('k', k, 'j', j, 'avant', case when j > 0 then sec -> 'carnets' -> k -> (j - 1) -> 'v' end));
    end if;
  end loop;
  return jsonb_build_object('etapes', etapes);
end;
$$;
revoke execute on function private.act_tour(public.parties, uuid, int, jsonb) from public, anon, authenticated;
