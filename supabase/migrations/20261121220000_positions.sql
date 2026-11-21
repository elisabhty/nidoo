-- « Où est la famille » (Elisa, 21 novembre) : la dernière position de chacun, visible seulement par sa famille.
-- Chacun choisit de la partager (et peut arrêter : sa ligne disparaît). Une seule ligne par membre : on ne garde
-- jamais d'historique des déplacements. L'iPhone la met à jour en arrière-plan quand on bouge (~500 m), avec la
-- clé widget du téléphone (la session du compte reste dans l'appli).

create table public.positions (
  member_id uuid primary key references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  -- la précision en mètres, la rue (« Rue André Lalande ») et la ville, la batterie du téléphone
  precision_m integer check (precision_m between 0 and 100000),
  lieu text check (char_length(lieu) <= 120),
  ville text check (char_length(ville) <= 80),
  batterie smallint check (batterie between 0 and 100),
  updated_at timestamptz not null default now()
);
create index positions_family_idx on public.positions (family_id);
alter table public.positions enable row level security;
revoke all on public.positions from public, anon, authenticated;
grant select on public.positions to authenticated;
-- on voit les positions de sa famille, et seulement elles ; on n'écrit que par les fonctions ci-dessous
create policy positions_select on public.positions for select to authenticated using (private.is_member(family_id));

-- Écrire la position d'un membre (le serveur arrondit à ~1 m et coupe les textes trop longs).
create function private.position_ecrire(p_member uuid, p_family uuid, p_lat double precision, p_lon double precision,
  p_precision integer, p_lieu text, p_ville text, p_batterie integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'POSITION_INVALIDE';
  end if;
  insert into public.positions as p (member_id, family_id, lat, lon, precision_m, lieu, ville, batterie, updated_at)
  values (
    p_member, p_family, round(p_lat::numeric, 5)::double precision, round(p_lon::numeric, 5)::double precision,
    case when p_precision between 0 and 100000 then p_precision end,
    nullif(left(btrim(coalesce(p_lieu, '')), 120), ''), nullif(left(btrim(coalesce(p_ville, '')), 80), ''),
    case when p_batterie between 0 and 100 then p_batterie end, now()
  )
  on conflict (member_id) do update set
    lat = excluded.lat, lon = excluded.lon, precision_m = excluded.precision_m, lieu = excluded.lieu,
    ville = excluded.ville, batterie = coalesce(excluded.batterie, p.batterie), updated_at = now();
end;
$$;

-- L'appli : je partage ma position avec cette famille (la première fois, ou quand l'appli est ouverte).
create function public.position_partager(p_family uuid, p_lat double precision, p_lon double precision,
  p_precision integer default null, p_lieu text default null, p_ville text default null, p_batterie integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  perform private.position_ecrire(mid, p_family, p_lat, p_lon, p_precision, p_lieu, p_ville, p_batterie);
end;
$$;

-- L'appli : je ne partage plus ma position avec cette famille (elle disparaît tout de suite).
create function public.position_arreter(p_family uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  delete from public.positions where member_id = mid;
end;
$$;

-- L'iPhone, en arrière-plan, avec la clé widget : la nouvelle position va à chaque maison où la personne la partage
-- déjà (jamais à une maison où elle ne l'a pas choisi). Renvoie le nombre de maisons mises à jour.
create function public.widget_position(p_key text, p_lat double precision, p_lon double precision,
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
    perform private.position_ecrire(r.member_id, r.family_id, p_lat, p_lon, p_precision, p_lieu, p_ville, p_batterie);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Les widgets voient aussi les positions : l'état d'avant, plus « positions ».
alter function private.widget_etat(uuid, uuid) rename to widget_etat_base;
create function private.widget_etat(p_family uuid, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.widget_etat_base(p_family, p_me) || jsonb_build_object('positions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.member_id, 'la', p.lat, 'lo', p.lon, 'p', p.precision_m, 'l', p.lieu, 'v', p.ville, 'b', p.batterie, 'q', p.updated_at
    ) order by p.updated_at desc), '[]'::jsonb)
    from public.positions p where p.family_id = p_family
  ));
$$;

revoke execute on function private.position_ecrire(uuid, uuid, double precision, double precision, integer, text, text, integer),
  private.widget_etat(uuid, uuid), private.widget_etat_base(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.position_partager(uuid, double precision, double precision, integer, text, text, integer),
  public.position_arreter(uuid), public.widget_position(text, double precision, double precision, integer, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.position_partager(uuid, double precision, double precision, integer, text, text, integer),
  public.position_arreter(uuid) to authenticated;
-- le téléphone en arrière-plan n'a pas de session : il se présente avec sa clé
grant execute on function public.widget_position(text, double precision, double precision, integer, text, text, integer) to anon, authenticated;

alter publication supabase_realtime add table public.positions;
