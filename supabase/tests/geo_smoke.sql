-- « Où sont mes proches ? », la suite (20261126220000_geo.sql) : partager pour un temps, position approximative,
-- « Bien arrivé ! », « Je suis en route » depuis le widget. Tout est annulé à la fin (rollback).
begin;
do $test$
declare
  u uuid := gen_random_uuid();      -- Léa, qui bouge
  papa uuid := gen_random_uuid();   -- Papa, qui a un téléphone
  dehors uuid := gen_random_uuid(); -- quelqu'un d'une autre maison
  f uuid; m uuid; mp uuid; enfant uuid; e uuid; cle text; n int; ok boolean; refuse boolean; etat jsonb; pos record;
  ecole_lat double precision := 45.9061; ecole_lon double precision := 6.1453;
begin
  insert into auth.users(id, email) values (u, 'geo-' || u || '@example.invalid'), (papa, 'geo-p-' || papa || '@example.invalid'),
    (dehors, 'geo-d-' || dehors || '@example.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('role', 'authenticated', true);
  f := public.create_family('Géo test rollback', 'maison', 'Léa', 'panda', 'lavande');
  select id into m from public.members where family_id = f and user_id = u;
  enfant := public.add_child(f, 'Bébé', 'panda', 'rose');
  insert into public.endroits(family_id, nom, lat, lon) values (f, 'École', ecole_lat, ecole_lon) returning id into e;
  cle := public.widget_cle(f);
  perform set_config('role', 'postgres', true);
  insert into public.members(family_id, user_id, display_name) values (f, papa, 'Papa') returning id into mp;

  -- ── partager pour un temps ──
  perform set_config('role', 'authenticated', true);
  refuse := false;
  begin
    perform public.position_partager(f, 45.92, 6.13, 20, 'Rue X', 'Annecy', 80, jsonb_build_object('jusqua', now() + interval '2 days'));
  exception when others then refuse := sqlerrm = 'DUREE_INVALIDE';
  end;
  if not refuse then raise exception 'Duration over 25 h accepted'; end if;
  ok := public.position_partager(f, 45.92, 6.13, 20, 'Rue X', 'Annecy', 80, jsonb_build_object('jusqua', now() + interval '1 hour'));
  if not ok then raise exception 'Temporary share refused'; end if;
  select count(*) into n from public.positions where family_id = f;
  if n <> 1 then raise exception 'Temporary share not visible: %', n; end if;
  -- l'heure passe
  perform set_config('role', 'postgres', true);
  update public.positions set jusqua = now() - interval '1 minute' where member_id = m;
  perform set_config('request.jwt.claims', json_build_object('sub', papa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', papa::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.positions where family_id = f;
  if n <> 0 then raise exception 'Expired share still visible to family'; end if;
  perform set_config('role', 'postgres', true);
  etat := private.widget_etat(f, mp);
  if jsonb_array_length(etat -> 'positions') <> 0 then raise exception 'Widget shows an expired share: %', etat -> 'positions'; end if;
  -- le téléphone de Léa repasse : rien à partager, la ligne s'en va
  n := public.widget_position(cle, 45.921, 6.131, 20, 'Rue X', 'Annecy', 80);
  if n <> 0 or exists (select 1 from public.positions where member_id = m) then raise exception 'Expired share kept by background update'; end if;
  -- une remise à jour automatique (sans réglages) ne relance pas un partage fini
  update public.positions set jusqua = null where member_id = m; -- (rien : déjà partie)
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.position_partager(f, 45.92, 6.13, 20, 'Rue X', 'Annecy', 80, jsonb_build_object('jusqua', now() + interval '1 hour'));
  perform set_config('role', 'postgres', true);
  update public.positions set jusqua = now() - interval '1 minute' where member_id = m;
  perform set_config('role', 'authenticated', true);
  ok := public.position_partager(f, 45.92, 6.13, 20, 'Rue X', 'Annecy', 80);
  if ok or exists (select 1 from public.positions where member_id = m) then raise exception 'Automatic refresh restarted a finished share'; end if;

  -- ── je repars, toujours, et je préviens en arrivant ──
  ok := public.position_partager(f, 45.92, 6.13, 20, 'Rue X', 'Annecy', 80, jsonb_build_object('jusqua', null, 'prevenir', true));
  select * into pos from public.positions where member_id = m;
  if pos.jusqua is not null or not pos.prevenir or pos.approx then raise exception 'Settings not kept: %', row_to_json(pos); end if;
  -- j'arrive à l'école (au passage d'arrière-plan) : Papa reçoit le petit mot, pas Bébé (sans téléphone)
  perform set_config('role', 'postgres', true);
  n := public.widget_position(cle, ecole_lat + 50 / 111195.0, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  if n <> 1 then raise exception 'Background update lost: %', n; end if;
  select count(*) into n from public.thoughts where from_member = m and to_member = mp and kind = 'mot' and message like '📍 École%je viens d’arriver%';
  if n <> 1 then raise exception 'Papa not told about the arrival: %', n; end if;
  select count(*) into n from public.thoughts where from_member = m and to_member = enfant;
  if n <> 0 then raise exception 'Child without phone got a thought'; end if;
  -- toujours à l'école : pas de nouveau petit mot
  n := public.widget_position(cle, ecole_lat + 60 / 111195.0, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  select count(*) into n from public.thoughts where from_member = m and message like '📍 École%';
  if n <> 1 then raise exception 'Arrival told twice while staying: %', n; end if;
  -- je sors puis je reviens dans la demi-heure : pas deux fois
  n := public.widget_position(cle, 45.95, 6.2, 15, 'Ailleurs', 'Annecy', 70);
  n := public.widget_position(cle, ecole_lat, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  select count(*) into n from public.thoughts where from_member = m and message like '📍 École%';
  if n <> 1 then raise exception 'Arrival told twice in half an hour: %', n; end if;
  -- le widget de Papa lit « École »
  etat := private.widget_etat(f, mp);
  if etat -> 'positions' -> 0 ->> 'l' <> 'École' or (etat -> 'positions' -> 0 ->> 'a')::boolean or not (etat ->> 'en_route')::boolean then
    raise exception 'Widget place name lost: %', etat -> 'positions';
  end if;

  -- ── position approximative ──
  perform set_config('role', 'authenticated', true);
  perform public.position_reglages(f, '{"approx": true}');
  select * into pos from public.positions where member_id = m;
  if pos.lat <> round(pos.lat::numeric, 2)::double precision or pos.lieu is not null or pos.precision_m < 1000 or not pos.approx then
    raise exception 'Approximate position not rounded: %', row_to_json(pos);
  end if;
  perform set_config('role', 'postgres', true);
  n := public.widget_position(cle, ecole_lat + 10 / 111195.0, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  select * into pos from public.positions where member_id = m;
  if pos.lat <> round(pos.lat::numeric, 2)::double precision or pos.lieu is not null or pos.ville <> 'Annecy' then
    raise exception 'Background update not approximate: %', row_to_json(pos);
  end if;
  etat := private.widget_etat(f, mp);
  if etat -> 'positions' -> 0 ->> 'l' is not null or etat -> 'positions' -> 0 ->> 'v' <> 'Annecy' or not (etat -> 'positions' -> 0 ->> 'a')::boolean then
    raise exception 'Widget reveals an approximate position: %', etat -> 'positions';
  end if;
  -- approximative : on part et on revient à l'école sans rien dire
  n := public.widget_position(cle, 45.95, 6.2, 15, 'Ailleurs', 'Annecy', 70);
  update public.thoughts set created_at = now() - interval '1 hour' where from_member = m;
  n := public.widget_position(cle, ecole_lat, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  select count(*) into n from public.thoughts where from_member = m and message like '📍 École%' and created_at > now() - interval '5 minutes';
  if n <> 0 then raise exception 'Approximate position told an arrival'; end if;
  -- plus approximative, toujours à l'école : pas de fausse arrivée
  perform set_config('role', 'authenticated', true);
  perform public.position_reglages(f, '{"approx": false}');
  perform set_config('role', 'postgres', true);
  n := public.widget_position(cle, ecole_lat, ecole_lon, 15, 'Avenue d''Albigny', 'Annecy', 70);
  select count(*) into n from public.thoughts where from_member = m and message like '📍 École%' and created_at > now() - interval '5 minutes';
  if n <> 0 then raise exception 'False arrival after leaving approximate mode'; end if;
  select * into pos from public.positions where member_id = m;
  if pos.lieu <> 'Avenue d''Albigny' or pos.approx then raise exception 'Precise position not back: %', row_to_json(pos); end if;

  -- ── « Je suis en route » depuis le widget ──
  etat := public.widget_agir(cle, 'en_route', '{}');
  select count(*) into n from public.thoughts where from_member = m and to_member = mp and message = 'Je suis en route' || chr(160) || '🚗';
  if n <> 1 then raise exception 'Default en route message not sent: %', n; end if;
  etat := public.widget_agir(cle, 'en_route', jsonb_build_object('m', 'Je suis en route, j’arrive vers 18 h 30 🚗'));
  select count(*) into n from public.thoughts where from_member = m and to_member = mp and message like 'Je suis en route, j’arrive vers%';
  if n <> 1 then raise exception 'Custom en route message not sent: %', n; end if;
  select count(*) into n from public.thoughts where from_member = m and to_member = enfant;
  if n <> 0 then raise exception 'En route sent to a child without phone'; end if;

  -- ── personne d'autre ne change mes réglages ──
  perform set_config('request.jwt.claims', json_build_object('sub', dehors, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', dehors::text, true);
  perform set_config('role', 'authenticated', true);
  refuse := false;
  begin
    perform public.position_reglages(f, '{"approx": false}');
  exception when others then refuse := sqlerrm = 'PAS_MEMBRE';
  end;
  if not refuse then raise exception 'Outsider changed settings'; end if;

  -- ── j'arrête : tout s'en va ──
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform public.position_arreter(f);
  perform set_config('role', 'postgres', true);
  if exists (select 1 from public.positions where member_id = m) or exists (select 1 from private.lieux_actuels where member_id = m) then
    raise exception 'Stopping left something behind';
  end if;
  perform set_config('role', 'authenticated', true);
  refuse := false;
  begin
    perform public.position_reglages(f, '{"approx": true}');
  exception when others then refuse := sqlerrm = 'PAS_PARTAGE';
  end;
  if not refuse then raise exception 'Settings changed while not sharing'; end if;
end $test$;
rollback;
