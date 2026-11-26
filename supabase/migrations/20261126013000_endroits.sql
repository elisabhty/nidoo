-- « Nos adresses » (Elisa, 26 novembre : « pouvoir enregistrer des adresses, école, travail, pour qu'on puisse ne
-- pas mettre l'adresse complète mais école, dans la partie où est ma famille »). Un endroit de la famille a un nom,
-- un point et un rayon. L'appli s'en sert pour lire « École » au lieu de la rue (src/lib/endroits.ts) et pour
-- proposer « École » comme lieu d'un événement ; les widgets aussi, par widget_etat ci-dessous, avec la même règle :
-- le plus proche des endroits dont on est dans le rayon, plus la précision de la position (200 m au plus).
-- Toute la famille les voit et peut les changer, comme l'agenda. Une maison en garde 30 au plus.

create table public.endroits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 30 and nom = btrim(nom)),
  adresse text check (char_length(adresse) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  rayon_m integer not null default 150 check (rayon_m between 50 and 1000),
  created_at timestamptz not null default now()
);
create index endroits_family_idx on public.endroits (family_id);
-- un nom ne sert qu'une fois par maison (« École » et « école » : le même ; l'appli dit « déjà pris » avant)
create unique index endroits_nom_idx on public.endroits (family_id, lower(nom));

alter table public.endroits enable row level security;
revoke all on public.endroits from public, anon, authenticated;
grant select, insert, update, delete on public.endroits to authenticated;
create policy endroits_all on public.endroits for all to authenticated
  using (private.is_member(family_id)) with check (private.is_member(family_id));

-- 30 adresses au plus par maison
create function private.endroits_max() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.endroits e where e.family_id = new.family_id) >= 30 then
    raise exception 'ENDROITS_COMPLET';
  end if;
  return new;
end;
$$;
create trigger endroits_max before insert on public.endroits for each row execute function private.endroits_max();

-- La distance en mètres entre deux points (haversine), comme distance() dans src/lib/positions.ts.
create function private.metres(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(least(1::double precision, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  )));
$$;

-- Les widgets « Où est la famille » : à une de nos adresses, son nom à la place de la rue et de la ville. Rien ne
-- change côté iPhone (le widget lit déjà « l » puis « v ») : pas besoin d'une nouvelle version de l'appli.
create or replace function private.widget_etat(p_family uuid, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.widget_etat_base(p_family, p_me) || jsonb_build_object('positions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.member_id, 'la', p.lat, 'lo', p.lon, 'p', p.precision_m,
      'l', coalesce(e.nom, p.lieu), 'v', case when e.nom is null then p.ville end,
      'b', p.batterie, 'q', p.updated_at
    ) order by p.updated_at desc), '[]'::jsonb)
    from public.positions p
    left join lateral (
      select x.nom from public.endroits x
      where x.family_id = p.family_id
        and private.metres(p.lat, p.lon, x.lat, x.lon) <= x.rayon_m + least(greatest(coalesce(p.precision_m, 0), 0), 200)
      order by private.metres(p.lat, p.lon, x.lat, x.lon)
      limit 1
    ) e on true
    where p.family_id = p_family
  ));
$$;

revoke execute on function private.endroits_max(), private.metres(double precision, double precision, double precision, double precision),
  private.widget_etat(uuid, uuid) from public, anon, authenticated;

alter publication supabase_realtime add table public.endroits;
