-- NIDOO — Jouer en famille, la suite.
-- Cinq jeux dans public.parties : bataille navale et dessine et devine (à deux), Qui de nous ?,
-- devine l'année et le téléphone dessiné (de 2 ou 3 joueurs à toute la famille). Et le mot mystère du jour,
-- le même mot pour toute la famille.
-- Comme pour les premiers jeux (0017), la base vérifie tout. Ce qui doit rester caché (les bateaux, le mot à dessiner,
-- les votes avant que tout le monde ait choisi, les années, les carnets du téléphone) est dans private.partie_secrets :
-- chacun ne reçoit que sa part, par public.secret_partie.

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('bataille', 'quidenous', 'dessin', 'annee', 'telephone')),
  players uuid[] not null check (cardinality(players) between 2 and 8),
  turn uuid,
  status text not null default 'en_cours' check (status in ('en_cours', 'fini')),
  winner uuid,
  state jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index parties_family_idx on public.parties (family_id, updated_at desc);

alter table public.parties enable row level security;
grant select on public.parties to authenticated;
create policy parties_select on public.parties for select to authenticated using (private.is_member(family_id));

create table private.partie_secrets (
  partie_id uuid primary key references public.parties (id) on delete cascade,
  data jsonb not null default '{}'
);
revoke all on private.partie_secrets from public, anon, authenticated;

-- ───────────────────────── Outils ─────────────────────────

/** Un mot sans accents, en minuscules, lettres seulement (« Éléphant ! » → « elephant »). */
create function private.norm(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(replace(replace(lower(coalesce(t, '')), 'œ', 'oe'), 'æ', 'ae'), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z]', '', 'g')
$$;

/** Le jour à Paris (un réglage de session le simule dans les tests SQL ; l'API ne peut pas le changer). */
create function private.jour_paris() returns date
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('nidoo.aujourdhui', true), '')::date, (now() at time zone 'Europe/Paris')::date);
$$;

/** Un dessin : des traits [{c, w, p: [x, y, x, y…]}] sur une feuille de 1000 × 750, pas trop lourd. */
create function private.dessin_ok(d jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(d) = 'array' and jsonb_array_length(d) between 1 and 400 and octet_length(d::text) < 90000
$$;

-- ───────────────────────── Les mots ─────────────────────────

-- Dessine et devine : des choses faciles à dessiner, pour les petits comme pour les grands.
create table private.mots_dessin (mot text primary key);
insert into private.mots_dessin (mot) values
  ('chat'), ('chien'), ('maison'), ('soleil'), ('arbre'), ('fleur'), ('voiture'), ('bateau'), ('avion'), ('poisson'),
  ('lune'), ('étoile'), ('gâteau'), ('pomme'), ('banane'), ('lunettes'), ('parapluie'), ('nuage'), ('montagne'), ('vélo'),
  ('train'), ('oiseau'), ('papillon'), ('escargot'), ('tortue'), ('lapin'), ('cochon'), ('vache'), ('cheval'), ('éléphant'),
  ('girafe'), ('serpent'), ('araignée'), ('crocodile'), ('pingouin'), ('baleine'), ('guitare'), ('piano'), ('ballon'), ('chapeau'),
  ('chaussure'), ('robe'), ('clé'), ('livre'), ('crayon'), ('ciseaux'), ('téléphone'), ('ordinateur'), ('télévision'), ('lampe'),
  ('bougie'), ('cadeau'), ('sapin'), ('glace'), ('pizza'), ('carotte'), ('fraise'), ('cerise'), ('champignon'), ('château'),
  ('fusée'), ('robot'), ('fantôme'), ('couronne'), ('bouteille'), ('tasse'), ('fourchette'), ('échelle'), ('pont'), ('phare'),
  ('pluie'), ('neige'), ('volcan'), ('cactus'), ('palmier'), ('plage'), ('tente'), ('lit'), ('chaise'), ('horloge'),
  ('cœur'), ('ancre'), ('drapeau'), ('dragon'), ('sirène'), ('licorne'), ('dinosaure'), ('abeille'), ('coccinelle'), ('hibou'),
  ('souris'), ('canard'), ('poule'), ('mouton'), ('requin'), ('pieuvre'), ('crabe'), ('citrouille'), ('bonbon'), ('sucette'),
  ('œuf'), ('fromage'), ('baguette'), ('valise'), ('cerf-volant'), ('arc-en-ciel'), ('bonhomme de neige'), ('tracteur'), ('camion'), ('hélicoptère');

-- Mot mystère : des mots de 5 lettres, connus de tous (sans les accents pour le jeu).
create table private.mots_mystere (mot text primary key check (mot ~ '^[A-Z]{5}$'));
insert into private.mots_mystere (mot) values
  ('ARBRE'), ('AVION'), ('BAGUE'), ('BALLE'), ('BLANC'), ('BOIRE'), ('BRAVE'), ('CADRE'), ('CALME'), ('CARTE'),
  ('CHANT'), ('CHAUD'), ('CHIEN'), ('CHOSE'), ('CIDRE'), ('CLOWN'), ('COEUR'), ('CORDE'), ('COUDE'), ('CRABE'),
  ('CREME'), ('DANSE'), ('DENTS'), ('DINER'), ('DOIGT'), ('DROLE'), ('ECOLE'), ('ELEVE'), ('FERME'), ('FLEUR'),
  ('FORET'), ('FOULE'), ('FRERE'), ('FRUIT'), ('GENOU'), ('GLACE'), ('GOMME'), ('GRAIN'), ('GUIDE'), ('HERBE'),
  ('HIVER'), ('HOTEL'), ('HUILE'), ('IMAGE'), ('JAUNE'), ('JOUER'), ('LAPIN'), ('LARME'), ('LIVRE'), ('LOUPE'),
  ('MAGIE'), ('MAINS'), ('MAMAN'), ('MARDI'), ('MERCI'), ('METRO'), ('MONDE'), ('MUSEE'), ('NEIGE'), ('NUAGE'),
  ('OCEAN'), ('OMBRE'), ('ONCLE'), ('ORAGE'), ('OUTIL'), ('PATES'), ('PELLE'), ('PERLE'), ('PETIT'), ('PHARE'),
  ('PIANO'), ('PIEDS'), ('PIZZA'), ('PLAGE'), ('PLUIE'), ('POIRE'), ('POMME'), ('PONEY'), ('PORTE'), ('POULE'),
  ('PRUNE'), ('RADIO'), ('REINE'), ('REVER'), ('ROBOT'), ('ROCHE'), ('RONDE'), ('ROUGE'), ('ROUTE'), ('SABLE'),
  ('SALON'), ('SAPIN'), ('SAUCE'), ('SINGE'), ('SOEUR'), ('SOUPE'), ('SPORT'), ('STYLO'), ('SUCRE'), ('TABLE'),
  ('TANTE'), ('TARTE'), ('TEMPS'), ('TERRE'), ('TIGRE'), ('TRAIN'), ('TROIS'), ('VACHE'), ('VALSE'), ('VERRE'),
  ('VILLE'), ('VOILE'), ('ZEBRE'), ('BISOU'), ('CALIN'), ('JOUET'), ('POUCE'), ('LAINE'), ('LITRE'), ('OLIVE'),
  ('MELON'), ('CHOUX'), ('RADIS'), ('LUNDI'), ('JEUDI'), ('AVRIL'), ('TASSE'), ('NAPPE'), ('CONTE'), ('FABLE'),
  ('PLUME'), ('ENCRE'), ('BOITE'), ('FUSEE'), ('ETAGE'), ('TAPIS'), ('LAMPE'), ('SIROP'), ('CREPE'), ('AMOUR'),
  ('FARCE'), ('KOALA'), ('PANDA'), ('HIBOU'), ('DINDE'), ('BICHE'), ('MOULE'), ('BALAI');

revoke all on private.mots_dessin, private.mots_mystere from public, anon, authenticated;

create function private.mot_au_hasard(sauf text default null) returns text
language sql volatile set search_path = '' as $$
  select mot from private.mots_dessin where mot is distinct from sauf order by random() limit 1
$$;

-- ───────────────────────── Bataille navale ─────────────────────────

/** Une flotte au hasard sur 8 × 8 (case = rangée*8 + colonne) : 4, 3, 3 et 2 cases, sans que deux bateaux se touchent. */
create function private.bataille_flotte() returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  tailles int[] := array[4, 3, 3, 2];
  occ boolean[];
  flotte jsonb;
  t int;
  ok boolean;
  r0 int;
  c0 int;
  h boolean;
  cells int[];
  k int;
  essai int;
  tour int := 0;
begin
  <<recommencer>>
  loop
    tour := tour + 1;
    occ := array_fill(false, array[64]);
    flotte := '[]';
    foreach t in array tailles loop
      essai := 0;
      loop
        essai := essai + 1;
        if essai > 300 then continue recommencer; end if;
        h := random() < 0.5;
        r0 := floor(random() * (case when h then 8 else 9 - t end))::int;
        c0 := floor(random() * (case when h then 9 - t else 8 end))::int;
        cells := '{}';
        for k in 0..t - 1 loop
          cells := cells || ((r0 + case when h then 0 else k end) * 8 + c0 + case when h then k else 0 end);
        end loop;
        ok := not exists (
          select 1 from unnest(cells) x, generate_series(-1, 1) dr, generate_series(-1, 1) dc
          where x / 8 + dr between 0 and 7 and x % 8 + dc between 0 and 7 and occ[(x / 8 + dr) * 8 + x % 8 + dc + 1]
        );
        exit when ok;
      end loop;
      foreach k in array cells loop occ[k + 1] := true; end loop;
      flotte := flotte || jsonb_build_array(to_jsonb(cells));
    end loop;
    exit recommencer when jsonb_array_length(flotte) = 4 or tour > 20;
  end loop;
  return flotte;
end;
$$;

create function private.act_bataille(pa public.parties, sec jsonb, me uuid, side int, a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  t text := a ->> 't';
  other int := 3 - side;
  cell int;
  plateau text := 'b' || other;
  coules text := 's' || other;
  bateau jsonb;
  vise jsonb;
  res text := 'eau';
begin
  if st ->> 'phase' = 'placement' then
    if (st -> 'pret' ->> (side - 1))::boolean then raise exception 'DEJA_FAIT'; end if;
    if t = 'melanger' then
      sec := jsonb_set(sec, array['f' || side], private.bataille_flotte());
      update private.partie_secrets set data = sec where partie_id = pa.id;
      return jsonb_build_object('flotte', sec -> ('f' || side));
    elsif t = 'pret' then
      st := jsonb_set(st, array['pret', (side - 1)::text], 'true');
      if (st -> 'pret' ->> 0)::boolean and (st -> 'pret' ->> 1)::boolean then
        st := jsonb_set(st, '{phase}', '"tirs"');
        update public.parties set state = st, turn = pa.players[1], updated_at = now() where id = pa.id;
      else
        update public.parties set state = st, updated_at = now() where id = pa.id;
      end if;
      return '{}';
    end if;
    raise exception 'COUP_INTERDIT';
  end if;

  if t is distinct from 'tir' then raise exception 'COUP_INTERDIT'; end if;
  if pa.turn is distinct from me then raise exception 'PAS_TON_TOUR'; end if;
  cell := (a ->> 'c')::int;
  if cell is null or cell not between 0 and 63 then raise exception 'COUP_INTERDIT'; end if;
  if (st -> plateau ->> cell)::int <> 0 then raise exception 'DEJA_TIRE'; end if;
  for bateau in select e.value from jsonb_array_elements(sec -> ('f' || other)) as e loop
    if bateau @> jsonb_build_array(cell) then vise := bateau; end if;
  end loop;
  st := jsonb_set(st, array[plateau, cell::text], case when vise is null then '1' else '2' end::jsonb);
  st := jsonb_set(st, '{dernier}', jsonb_build_object('c', cell, 'par', side));
  if vise is not null then
    res := 'touche';
    if not exists (select 1 from jsonb_array_elements_text(vise) x where (st -> plateau ->> x::int)::int <> 2) then
      res := 'coule';
      st := jsonb_set(st, array[coules], (st -> coules) || jsonb_build_array(vise));
    end if;
  end if;
  if jsonb_array_length(st -> coules) = jsonb_array_length(sec -> ('f' || other)) then
    update public.parties set state = st, status = 'fini', winner = me, turn = null, updated_at = now() where id = pa.id;
    perform private.award(pa.family_id, me, 'partie', 2, 5);
    return jsonb_build_object('r', res, 'gagne', true);
  end if;
  update public.parties set state = st, turn = pa.players[other], updated_at = now() where id = pa.id;
  return jsonb_build_object('r', res);
end;
$$;

-- ───────────────────────── Qui de nous ? ─────────────────────────

create function private.act_quidenous(pa public.parties, sec jsonb, me uuid, a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  cible uuid;
  i int := (pa.state ->> 'i')::int;
  accord boolean;
begin
  if a ->> 't' is distinct from 'vote' then raise exception 'COUP_INTERDIT'; end if;
  begin
    cible := (a ->> 'cible')::uuid;
  exception when others then
    raise exception 'COUP_INTERDIT';
  end;
  if cible is null or not cible = any (pa.players) then raise exception 'COUP_INTERDIT'; end if;
  if (st -> 'votes') @> jsonb_build_array(me) then raise exception 'DEJA_FAIT'; end if;
  sec := jsonb_set(sec, array['votes', me::text], to_jsonb(cible));
  st := jsonb_set(st, '{votes}', (st -> 'votes') || jsonb_build_array(me));
  if jsonb_array_length(st -> 'votes') >= cardinality(pa.players) then
    -- Tout le monde a choisi : on retourne les cartes.
    accord := (select count(distinct v) from jsonb_each_text(sec -> 'votes') e(k, v)) = 1;
    st := jsonb_set(st, '{rondes}', (st -> 'rondes') || jsonb_build_array(jsonb_build_object('q', st -> 'q' -> i, 'v', sec -> 'votes', 'accord', accord)));
    if accord then
      st := jsonb_set(st, '{accords}', to_jsonb((st ->> 'accords')::int + 1));
      perform private.award(pa.family_id, me, 'accord', 1, 10);
    end if;
    i := i + 1;
    st := jsonb_set(jsonb_set(st, '{i}', to_jsonb(i)), '{votes}', '[]');
    sec := jsonb_set(sec, '{votes}', '{}');
    if i >= jsonb_array_length(st -> 'q') then
      update public.parties set state = st, status = 'fini', updated_at = now() where id = pa.id;
    else
      update public.parties set state = st, updated_at = now() where id = pa.id;
    end if;
    update private.partie_secrets set data = sec where partie_id = pa.id;
    return jsonb_build_object('revele', true, 'accord', accord);
  end if;
  update public.parties set state = st, updated_at = now() where id = pa.id;
  update private.partie_secrets set data = sec where partie_id = pa.id;
  return jsonb_build_object('revele', false);
end;
$$;

-- ───────────────────────── Dessine et devine ─────────────────────────

create function private.act_dessin(pa public.parties, sec jsonb, me uuid, side int, a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  t text := a ->> 't';
  i int := (pa.state ->> 'i')::int;
  dessinateur int := (i % 2) + 1;
  mot text := sec ->> 'mot';
  essai text;
  trouve boolean;
  fin boolean := false;
begin
  if pa.turn is distinct from me then raise exception 'PAS_TON_TOUR'; end if;
  if st ->> 'phase' = 'dessin' then
    if side <> dessinateur then raise exception 'PAS_TON_TOUR'; end if;
    if t = 'autre' then
      sec := jsonb_set(sec, '{mot}', to_jsonb(private.mot_au_hasard(mot)));
      update private.partie_secrets set data = sec where partie_id = pa.id;
      return jsonb_build_object('mot', sec ->> 'mot');
    elsif t = 'dessin' then
      if not private.dessin_ok(a -> 'd') then raise exception 'DESSIN_VIDE'; end if;
      st := jsonb_set(jsonb_set(jsonb_set(st, '{dessin}', a -> 'd'), '{phase}', '"devine"'), '{essais}', '[]');
      update public.parties set state = st, turn = pa.players[3 - dessinateur], updated_at = now() where id = pa.id;
      return '{}';
    end if;
    raise exception 'COUP_INTERDIT';
  end if;

  -- On devine (3 essais).
  if t is distinct from 'devine' or side = dessinateur then raise exception 'COUP_INTERDIT'; end if;
  essai := left(btrim(coalesce(a ->> 'mot', '')), 40);
  if private.norm(essai) = '' then raise exception 'REPONSE_VIDE'; end if;
  trouve := private.norm(essai) in (private.norm(mot), private.norm(mot) || 's', private.norm(mot) || 'x')
    or private.norm(mot) = private.norm(essai) || 's';
  st := jsonb_set(st, '{essais}', (st -> 'essais') || jsonb_build_array(essai));
  if not trouve and jsonb_array_length(st -> 'essais') < 3 then
    update public.parties set state = st, updated_at = now() where id = pa.id;
    return jsonb_build_object('trouve', false, 'reste', 3 - jsonb_array_length(st -> 'essais'));
  end if;
  -- Fin de la manche : le mot se dévoile, on garde le dessin dans l'album de la partie.
  st := jsonb_set(st, '{rondes}', (st -> 'rondes') || jsonb_build_array(jsonb_build_object(
    'mot', mot, 'dessin', st -> 'dessin', 'essais', st -> 'essais', 'trouve', trouve, 'par', pa.players[dessinateur])));
  if trouve then
    st := jsonb_set(st, '{trouves}', to_jsonb((st ->> 'trouves')::int + 1));
    perform private.award(pa.family_id, me, 'trouve', 1, 10);
  end if;
  i := i + 1;
  st := jsonb_set(jsonb_set(jsonb_set(jsonb_set(st, '{i}', to_jsonb(i)), '{phase}', '"dessin"'), '{dessin}', 'null'), '{essais}', '[]');
  fin := i >= (st ->> 'n')::int;
  if fin then
    update public.parties set state = st, status = 'fini', turn = null, updated_at = now() where id = pa.id;
  else
    sec := jsonb_set(sec, '{mot}', to_jsonb(private.mot_au_hasard(mot)));
    update private.partie_secrets set data = sec where partie_id = pa.id;
    -- celui qui devinait dessine à son tour
    update public.parties set state = st, turn = me, updated_at = now() where id = pa.id;
  end if;
  return jsonb_build_object('trouve', trouve, 'mot', mot, 'fini', fin);
end;
$$;

-- ───────────────────────── Devine l'année ─────────────────────────

create function private.annee_revele(pa public.parties, sec jsonb, st jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  totaux jsonb := '{}';
  k text;
  rep jsonb;
  tot int;
  best int;
  gagnant uuid;
  exaequo boolean := false;
begin
  for k, rep in select * from jsonb_each(sec -> 'reponses') loop
    select sum(abs((rep ->> (o - 1)::int)::int - x::int)) into tot
      from jsonb_array_elements_text(sec -> 'annees') with ordinality e(x, o);
    totaux := totaux || jsonb_build_object(k, tot);
    if best is null or tot < best then
      best := tot;
      gagnant := k::uuid;
      exaequo := false;
    elsif tot = best then
      exaequo := true;
    end if;
  end loop;
  st := st || jsonb_build_object('annees', sec -> 'annees', 'reponses', sec -> 'reponses', 'totaux', totaux);
  update public.parties set state = st, status = 'fini', turn = null, updated_at = now(),
    winner = case when exaequo then null else gagnant end
    where id = pa.id;
  if gagnant is not null and not exaequo then
    perform private.award(pa.family_id, gagnant, 'partie', 2, 5);
  end if;
end;
$$;

create function private.act_annee(pa public.parties, sec jsonb, me uuid, side int, a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  n int := jsonb_array_length(pa.state -> 'photos');
  r jsonb := a -> 'r';
  an int := extract(year from now())::int;
begin
  if a ->> 't' = 'reveler' then
    -- celui qui a partagé les photos peut dévoiler les réponses sans attendre tout le monde
    if side <> 1 then raise exception 'PAS_TON_TOUR'; end if;
    if jsonb_array_length(st -> 'fait') = 0 then raise exception 'PERSONNE_N_A_REPONDU'; end if;
    perform private.annee_revele(pa, sec, st);
    return '{}';
  end if;
  if a ->> 't' is distinct from 'reponses' or side = 1 then raise exception 'COUP_INTERDIT'; end if;
  if (st -> 'fait') @> jsonb_build_array(me) then raise exception 'DEJA_FAIT'; end if;
  if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> n
     or exists (select 1 from jsonb_array_elements(r) x where jsonb_typeof(x) <> 'number' or x::int not between 1850 and an) then
    raise exception 'ANNEE_INVALIDE';
  end if;
  sec := jsonb_set(sec, array['reponses', me::text], r);
  st := jsonb_set(st, '{fait}', (st -> 'fait') || jsonb_build_array(me));
  update private.partie_secrets set data = sec where partie_id = pa.id;
  if jsonb_array_length(st -> 'fait') >= cardinality(pa.players) - 1 then
    perform private.annee_revele(pa, sec, st);
    return jsonb_build_object('revele', true);
  end if;
  update public.parties set state = st, updated_at = now() where id = pa.id;
  return jsonb_build_object('revele', false);
end;
$$;

-- ───────────────────────── Le téléphone dessiné ─────────────────────────
-- Chaque joueur commence un carnet par une phrase. Le carnet passe au suivant, qui la dessine ; le suivant
-- décrit le dessin par une phrase, le suivant la dessine… jusqu'à ce que chacun y soit passé une fois.
-- Le carnet k, étape j, revient au joueur (k + j) mod n. Quand tous les carnets sont pleins, on les découvre tous.

create function private.act_telephone(pa public.parties, sec jsonb, me uuid, side int, a jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  st jsonb := pa.state;
  n int := cardinality(pa.players);
  k int := (a ->> 'k')::int;
  j int;
  v jsonb := a -> 'v';
  p uuid;
begin
  if a ->> 't' is distinct from 'etape' or k is null or k not between 0 and n - 1 then raise exception 'COUP_INTERDIT'; end if;
  j := (st -> 'avance' ->> k)::int;
  if j >= n then raise exception 'DEJA_FAIT'; end if;
  if pa.players[((k + j) % n) + 1] <> me then raise exception 'PAS_TON_TOUR'; end if;
  if j % 2 = 0 then
    if jsonb_typeof(v) <> 'string' or length(btrim(v #>> '{}')) not between 2 and 90 then raise exception 'REPONSE_VIDE'; end if;
    v := to_jsonb(btrim(v #>> '{}'));
  elsif not private.dessin_ok(v) then
    raise exception 'DESSIN_VIDE';
  end if;
  sec := jsonb_set(sec, array['carnets', k::text], (sec -> 'carnets' -> k) || jsonb_build_array(jsonb_build_object('par', me, 'v', v)));
  st := jsonb_set(st, array['avance', k::text], to_jsonb(j + 1));
  update private.partie_secrets set data = sec where partie_id = pa.id;
  if not exists (select 1 from jsonb_array_elements_text(st -> 'avance') x where x::int < n) then
    st := jsonb_set(st, '{album}', sec -> 'carnets');
    update public.parties set state = st, status = 'fini', updated_at = now() where id = pa.id;
    foreach p in array pa.players loop
      perform private.award(pa.family_id, p, 'album', 1, 5);
    end loop;
    return jsonb_build_object('fini', true);
  end if;
  update public.parties set state = st, updated_at = now() where id = pa.id;
  return jsonb_build_object('fini', false);
end;
$$;

-- ───────────────────────── Les fonctions appelées par l'appli ─────────────────────────

/** Lancer une partie avec des proches (qui ont un téléphone). Celui qui lance est le premier joueur.
 *  p_setup : Qui de nous ? {q: [numéros des questions]} ; devine l'année {photos: [chemins], annees: [années]}. */
create function public.start_partie(p_family uuid, p_kind text, p_players uuid[], p_setup jsonb default '{}')
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
  if p_kind not in ('bataille', 'quidenous', 'dessin', 'annee', 'telephone') then raise exception 'JEU_INCONNU'; end if;
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
     or (p_kind = 'telephone' and n not between 3 and 8) then
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
  else
    st := jsonb_build_object('avance', (select jsonb_agg(0) from generate_series(1, n)));
    sec := jsonb_build_object('carnets', (select jsonb_agg('[]'::jsonb) from generate_series(1, n)));
  end if;

  insert into public.parties (family_id, kind, players, turn, state) values (p_family, p_kind, pl, tour, st) returning id into pid;
  insert into private.partie_secrets (partie_id, data) values (pid, sec);
  return pid;
end;
$$;

/** Jouer : un tir, un vote, un dessin, une réponse… Renvoie ce que le joueur a besoin de savoir tout de suite. */
create function public.act_partie(p_partie uuid, p_action jsonb)
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
    else private.act_telephone(pa, sec, me, side, p_action)
  end;
end;
$$;

/** Ce que je suis seul à voir : mes bateaux, le mot à dessiner, mon vote, mes réponses, les étapes qui m'attendent. */
create function public.secret_partie(p_partie uuid)
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

/** Quitter : à deux, l'autre gagne (sans étoile) ; en groupe, la partie s'arrête pour tout le monde. */
create function public.quit_partie(p_partie uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  pa public.parties%rowtype;
  me uuid;
begin
  select * into pa from public.parties where id = p_partie for update;
  if not found then raise exception 'PARTIE_INCONNUE'; end if;
  me := private.my_member(pa.family_id);
  if me is null or not me = any (pa.players) then raise exception 'PAS_JOUEUR'; end if;
  if pa.status = 'fini' then return; end if;
  update public.parties
    set status = 'fini', turn = null, updated_at = now(),
        state = state || jsonb_build_object('abandon', true, 'par', me),
        winner = case when pa.kind in ('bataille', 'dessin') then (select x from unnest(pa.players) x where x <> me limit 1) end
    where id = pa.id;
end;
$$;

-- ───────────────────────── Mot mystère ─────────────────────────
-- Le même mot pour toute la famille (et pour tout le monde) chaque jour, 6 essais. La famille voit les couleurs
-- des essais de chacun, jamais les lettres : les mots tapés restent dans private.mot_mots.

create table public.mot_essais (
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  day date not null,
  motifs text[] not null default '{}',
  trouve boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, day)
);
create index mot_essais_family_idx on public.mot_essais (family_id, day);
alter table public.mot_essais enable row level security;
grant select on public.mot_essais to authenticated;
create policy mot_essais_select on public.mot_essais for select to authenticated using (private.is_member(family_id));

create table private.mot_mots (
  member_id uuid not null references public.members (id) on delete cascade,
  day date not null,
  mots text[] not null default '{}',
  primary key (member_id, day)
);
revoke all on private.mot_mots from public, anon, authenticated;

create function private.mot_du_jour(d date) returns text
language sql stable security definer set search_path = '' as $$
  select mot from private.mots_mystere
  order by md5(mot || 'nidoo')
  offset ((d - date '2026-01-01') % (select count(*) from private.mots_mystere) + (select count(*) from private.mots_mystere))
         % (select count(*) from private.mots_mystere)
  limit 1
$$;

/** Les couleurs d'un essai : 2 bien placée, 1 dans le mot mais ailleurs, 0 absente (en tenant compte des lettres en double). */
create function private.mot_motif(essai text, mot text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  res text[] := array['0', '0', '0', '0', '0'];
  reste text := '';
  k int;
  p int;
begin
  for k in 1..5 loop
    if substr(essai, k, 1) = substr(mot, k, 1) then
      res[k] := '2';
    else
      reste := reste || substr(mot, k, 1);
    end if;
  end loop;
  for k in 1..5 loop
    if res[k] = '0' then
      p := position(substr(essai, k, 1) in reste);
      if p > 0 then
        res[k] := '1';
        reste := overlay(reste placing '.' from p for 1);
      end if;
    end if;
  end loop;
  return array_to_string(res, '');
end;
$$;

create function public.mot_essai(p_family uuid, p_mot text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  d date := private.jour_paris();
  w text := upper(private.norm(p_mot));
  sol text := private.mot_du_jour(private.jour_paris());
  ligne public.mot_essais%rowtype;
  motif text;
  v_trouve boolean;
  v_fini boolean;
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  if w !~ '^[A-Z]{5}$' then raise exception 'MOT_5_LETTRES'; end if;
  insert into public.mot_essais (family_id, member_id, day) values (p_family, me, d) on conflict do nothing;
  insert into private.mot_mots (member_id, day) values (me, d) on conflict do nothing;
  select * into ligne from public.mot_essais where member_id = me and day = d for update;
  if ligne.trouve or cardinality(ligne.motifs) >= 6 then raise exception 'MOT_FINI'; end if;
  motif := private.mot_motif(w, sol);
  v_trouve := w = sol;
  v_fini := v_trouve or cardinality(ligne.motifs) + 1 >= 6;
  update public.mot_essais set motifs = motifs || motif, trouve = v_trouve, updated_at = now() where member_id = me and day = d;
  update private.mot_mots set mots = mots || w where member_id = me and day = d;
  if v_trouve then perform private.award(p_family, me, 'mot', 2, 1); end if;
  return jsonb_build_object('motif', motif, 'trouve', v_trouve, 'solution', case when v_fini then sol end);
end;
$$;

/** Mes essais du jour (avec les lettres), et la solution une fois la grille finie. */
create function public.mot_mes_essais(p_family uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  d date := private.jour_paris();
  e public.mot_essais%rowtype;
  v_mots text[];
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  select * into e from public.mot_essais where member_id = me and day = d;
  select m.mots into v_mots from private.mot_mots m where m.member_id = me and m.day = d;
  return jsonb_build_object('jour', d, 'mots', to_jsonb(coalesce(v_mots, '{}')),
    'solution', case when e.trouve or cardinality(e.motifs) >= 6 then private.mot_du_jour(d) end);
end;
$$;

revoke execute on function public.start_partie(uuid, text, uuid[], jsonb), public.act_partie(uuid, jsonb),
  public.secret_partie(uuid), public.quit_partie(uuid), public.mot_essai(uuid, text), public.mot_mes_essais(uuid) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.start_partie(uuid, text, uuid[], jsonb), public.act_partie(uuid, jsonb),
  public.secret_partie(uuid), public.quit_partie(uuid), public.mot_essai(uuid, text), public.mot_mes_essais(uuid) to authenticated;

alter publication supabase_realtime add table public.parties, public.mot_essais;
