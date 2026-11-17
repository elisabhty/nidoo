-- NIDOO — Jouer ensemble : Puissance 4, morpion et memory photos.
-- On joue à tour de rôle (chacun quand il veut, la partie peut durer deux jours) ou en direct si les deux
-- sont là : chaque coup arrive tout de suite chez l'autre par le temps réel.
-- La base vérifie tout : à qui c'est le tour, que le coup est permis, qui a gagné.
-- Au memory, l'ordre des cartes reste caché dans private.game_decks : une carte ne se voit qu'une fois retournée.
-- Une partie gagnée rapporte 2 étoiles à la maison (5 fois par jour au plus pour chacun).

create table public.games (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('puissance4', 'morpion', 'memory')),
  p1 uuid not null references public.members (id) on delete cascade,
  p2 uuid not null references public.members (id) on delete cascade,
  turn uuid references public.members (id) on delete set null,
  status text not null default 'en_cours' check (status in ('en_cours', 'fini')),
  winner uuid references public.members (id) on delete set null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (p1 <> p2)
);
create index games_family_idx on public.games (family_id, updated_at desc);

-- Toute la famille peut suivre les parties (et encourager) ; personne n'écrit directement.
alter table public.games enable row level security;
grant select on public.games to authenticated;
create policy games_select on public.games for select to authenticated using (private.is_member(family_id));

create table private.game_decks (
  game_id uuid primary key references public.games (id) on delete cascade,
  deck int[] not null,
  pending int
);
revoke all on private.game_decks from public, anon, authenticated;

-- Les photos du memory : <famille>/<fichier>, lisibles par la famille.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jeux', 'jeux', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy jeux_select on storage.objects for select to authenticated
  using (bucket_id = 'jeux' and private.is_member(private.family_of_path(name)));
create policy jeux_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'jeux' and private.is_member(private.family_of_path(name)));
create policy jeux_delete on storage.objects for delete to authenticated
  using (bucket_id = 'jeux' and owner_id = (select auth.uid())::text);

-- ───────────────────────── Règles ─────────────────────────

create function private.ints(j jsonb) returns int[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(v::int order by o), '{}') from jsonb_array_elements_text(j) with ordinality t(v, o)
$$;

/** Puissance 4 (7 colonnes, 6 rangées, case = rangée*7 + colonne, rangée 0 en haut) : l'alignement gagnant, ou rien. */
create function private.p4_line(g int[], idx int, side int) returns int[]
language plpgsql immutable set search_path = '' as $$
declare
  d int[] := array[0, 1, 1, 0, 1, 1, 1, -1];
  k int;
  r0 int := idx / 7;
  c0 int := idx % 7;
  r int;
  c int;
  line int[];
begin
  for k in 0..3 loop
    line := array[idx];
    r := r0 + d[k * 2 + 1];
    c := c0 + d[k * 2 + 2];
    while r between 0 and 5 and c between 0 and 6 and g[r * 7 + c + 1] = side loop
      line := line || (r * 7 + c);
      r := r + d[k * 2 + 1];
      c := c + d[k * 2 + 2];
    end loop;
    r := r0 - d[k * 2 + 1];
    c := c0 - d[k * 2 + 2];
    while r between 0 and 5 and c between 0 and 6 and g[r * 7 + c + 1] = side loop
      line := line || (r * 7 + c);
      r := r - d[k * 2 + 1];
      c := c - d[k * 2 + 2];
    end loop;
    if array_length(line, 1) >= 4 then return line; end if;
  end loop;
  return null;
end;
$$;

create function private.morpion_line(g int[], side int) returns int[]
language sql immutable set search_path = '' as $$
  select array[a, b, c] from (values (0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6)) v(a, b, c)
  where g[a + 1] = side and g[b + 1] = side and g[c + 1] = side
  limit 1
$$;

-- ───────────────────────── Parties ─────────────────────────

/** Lancer une partie contre un proche (qui a un téléphone). Celui qui invite joue le premier.
 *  Au memory, de 4 à 8 photos de la famille (déjà envoyées dans le bucket « jeux ») : chacune fait une paire. */
create function public.start_game(p_family uuid, p_kind text, p_opponent uuid, p_photos text[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  gid uuid;
  n int;
  st jsonb;
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  if p_kind not in ('puissance4', 'morpion', 'memory') then raise exception 'JEU_INCONNU'; end if;
  if p_opponent = me or not exists (
    select 1 from public.members m where m.id = p_opponent and m.family_id = p_family and m.user_id is not null
  ) then
    raise exception 'ADVERSAIRE_INCONNU';
  end if;
  -- Une seule partie en cours du même jeu entre les deux mêmes joueurs : on la reprend.
  select g.id into gid from public.games g
    where g.family_id = p_family and g.kind = p_kind and g.status = 'en_cours'
      and ((g.p1 = me and g.p2 = p_opponent) or (g.p1 = p_opponent and g.p2 = me))
    limit 1;
  if gid is not null then return gid; end if;
  if (select count(*) from public.games g where g.family_id = p_family and g.status = 'en_cours') >= 40 then
    raise exception 'TROP_DE_PARTIES';
  end if;
  if p_kind = 'memory' then
    n := coalesce(array_length(p_photos, 1), 0);
    if n < 4 then raise exception 'MEMORY_PHOTOS'; end if;
    if n > 8 then raise exception 'MEMORY_TROP_DE_PHOTOS'; end if;
    if (select count(*) from storage.objects o
        where o.bucket_id = 'jeux' and o.name = any (p_photos) and o.name like p_family::text || '/%') <> n then
      raise exception 'PHOTO_INCONNUE';
    end if;
    st := jsonb_build_object(
      'n', n, 'paths', to_jsonb(p_photos), 'open', '[]'::jsonb, 'score', '[0, 0]'::jsonb,
      'found', (select jsonb_agg(null::jsonb) from generate_series(1, 2 * n))
    );
  elsif p_kind = 'puissance4' then
    st := jsonb_build_object('g', (select jsonb_agg(0) from generate_series(1, 42)));
  else
    st := jsonb_build_object('g', (select jsonb_agg(0) from generate_series(1, 9)));
  end if;
  insert into public.games (family_id, kind, p1, p2, turn, state)
    values (p_family, p_kind, me, p_opponent, me, st)
    returning id into gid;
  if p_kind = 'memory' then
    insert into private.game_decks (game_id, deck)
      select gid, array_agg(x order by random())
      from (select generate_series(0, n - 1) as x union all select generate_series(0, n - 1)) s;
  end if;
  return gid;
end;
$$;

/** Jouer un coup : la colonne (Puissance 4), la case (morpion) ou la carte à retourner (memory). */
create function public.play_game(p_game uuid, p_move int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  gm public.games%rowtype;
  dk private.game_decks%rowtype;
  me uuid;
  side int;
  other uuid;
  g int[];
  idx int;
  r int;
  line int[];
  st jsonb;
  n int;
  j int;
  fa int;
  fb int;
  s1 int;
  s2 int;
begin
  select * into gm from public.games where id = p_game for update;
  if not found then raise exception 'PARTIE_INCONNUE'; end if;
  me := private.my_member(gm.family_id);
  if me is null or me not in (gm.p1, gm.p2) then raise exception 'PAS_JOUEUR'; end if;
  if gm.status <> 'en_cours' then raise exception 'PARTIE_FINIE'; end if;
  if gm.turn is distinct from me then raise exception 'PAS_TON_TOUR'; end if;
  side := case when me = gm.p1 then 1 else 2 end;
  other := case when side = 1 then gm.p2 else gm.p1 end;
  st := gm.state;

  if gm.kind in ('puissance4', 'morpion') then
    g := private.ints(st -> 'g');
    if gm.kind = 'puissance4' then
      if p_move is null or p_move not between 0 and 6 then raise exception 'COUP_INTERDIT'; end if;
      for r in reverse 5..0 loop
        if g[r * 7 + p_move + 1] = 0 then
          idx := r * 7 + p_move;
          exit;
        end if;
      end loop;
      if idx is null then raise exception 'COLONNE_PLEINE'; end if;
      g[idx + 1] := side;
      line := private.p4_line(g, idx, side);
    else
      if p_move is null or p_move not between 0 and 8 or g[p_move + 1] <> 0 then raise exception 'COUP_INTERDIT'; end if;
      idx := p_move;
      g[idx + 1] := side;
      line := private.morpion_line(g, side);
    end if;
    st := jsonb_build_object('g', to_jsonb(g), 'last', idx, 'line', to_jsonb(line));
    if line is not null then
      update public.games set state = st, status = 'fini', winner = me, turn = null, updated_at = now() where id = gm.id;
      perform private.award(gm.family_id, me, 'partie', 2, 5);
    elsif not (0 = any (g)) then
      update public.games set state = st, status = 'fini', winner = null, turn = null, updated_at = now() where id = gm.id;
    else
      update public.games set state = st, turn = other, updated_at = now() where id = gm.id;
    end if;
    return;
  end if;

  -- Memory : on retourne une carte, puis une deuxième. Une paire trouvée, on rejoue ; sinon, la main passe.
  select * into dk from private.game_decks where game_id = gm.id for update;
  n := (st ->> 'n')::int;
  if p_move is null or p_move not between 0 and 2 * n - 1 or jsonb_typeof(st -> 'found' -> p_move) <> 'null' then
    raise exception 'COUP_INTERDIT';
  end if;
  if dk.pending is null then
    -- la première carte ; la paire ratée du tour d'avant se referme
    st := jsonb_set(st, '{open}', jsonb_build_array(jsonb_build_object('i', p_move, 'f', dk.deck[p_move + 1])));
    update private.game_decks set pending = p_move where game_id = gm.id;
    update public.games set state = st, updated_at = now() where id = gm.id;
    return;
  end if;
  j := dk.pending;
  if j = p_move then raise exception 'COUP_INTERDIT'; end if;
  fa := dk.deck[j + 1];
  fb := dk.deck[p_move + 1];
  st := jsonb_set(st, '{open}', jsonb_build_array(jsonb_build_object('i', j, 'f', fa), jsonb_build_object('i', p_move, 'f', fb)));
  update private.game_decks set pending = null where game_id = gm.id;
  if fa <> fb then
    update public.games set state = st, turn = other, updated_at = now() where id = gm.id;
    return;
  end if;
  st := jsonb_set(st, array['found', j::text], jsonb_build_object('f', fa, 'p', side));
  st := jsonb_set(st, array['found', p_move::text], jsonb_build_object('f', fb, 'p', side));
  st := jsonb_set(st, array['score', (side - 1)::text], to_jsonb((st -> 'score' ->> (side - 1))::int + 1));
  if exists (select 1 from jsonb_array_elements(st -> 'found') e where jsonb_typeof(e) = 'null') then
    update public.games set state = st, updated_at = now() where id = gm.id;
    return;
  end if;
  s1 := (st -> 'score' ->> 0)::int;
  s2 := (st -> 'score' ->> 1)::int;
  update public.games set state = st, status = 'fini', turn = null, updated_at = now(),
    winner = case when s1 > s2 then gm.p1 when s2 > s1 then gm.p2 end
    where id = gm.id;
  if s1 <> s2 then
    perform private.award(gm.family_id, case when s1 > s2 then gm.p1 else gm.p2 end, 'partie', 2, 5);
  end if;
end;
$$;

/** Abandonner : l'autre gagne (sans étoile). */
create function public.quit_game(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  gm public.games%rowtype;
  me uuid;
begin
  select * into gm from public.games where id = p_game for update;
  if not found then raise exception 'PARTIE_INCONNUE'; end if;
  me := private.my_member(gm.family_id);
  if me is null or me not in (gm.p1, gm.p2) then raise exception 'PAS_JOUEUR'; end if;
  if gm.status = 'fini' then return; end if;
  update public.games
    set status = 'fini', turn = null, updated_at = now(), state = state || '{"abandon": true}'::jsonb,
        winner = case when me = gm.p1 then gm.p2 else gm.p1 end
    where id = gm.id;
end;
$$;

revoke execute on function public.start_game(uuid, text, uuid, text[]), public.play_game(uuid, int), public.quit_game(uuid) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.start_game(uuid, text, uuid, text[]) to authenticated;
grant execute on function public.play_game(uuid, int) to authenticated;
grant execute on function public.quit_game(uuid) to authenticated;

alter publication supabase_realtime add table public.games;
