-- NIDOO — Le calendrier de l'Avent : 24 cases, du 1er au 24 décembre, à ouvrir en famille.
-- Une case s'ouvre à partir de son jour (heure de Paris), une seule fois par maison : celui qui l'ouvre
-- l'ouvre pour tout le monde, et chaque case ouverte décore le sapin de la famille.
-- Chaque case rapporte 1 étoile à la maison (3 pour celle du 24). Les cases oubliées s'ouvrent encore après leur jour.
--
-- public.app_flags : des interrupteurs à distance, sans nouvelle version de l'appli.
-- Dans Supabase : Table Editor › app_flags › ligne « avent » :
--   enabled = false  → le calendrier disparaît (au prochain lancement de l'appli) ;
--   starts_at / ends_at → la période d'affichage (par défaut du 1er au 31 décembre, heure de Paris).

create table public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  note text
);
alter table public.app_flags enable row level security;
grant select on public.app_flags to anon, authenticated;
create policy app_flags_read on public.app_flags for select to anon, authenticated using (true);

insert into public.app_flags (key, enabled, starts_at, ends_at, note) values (
  'avent', true, '2026-12-01 00:00 Europe/Paris', '2027-01-01 00:00 Europe/Paris',
  'Calendrier de l''Avent. Décocher enabled pour le cacher tout de suite ; starts_at / ends_at = période d''affichage.'
) on conflict (key) do nothing;

create function private.flag_on(p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select f.enabled and (f.starts_at is null or now() >= f.starts_at) and (f.ends_at is null or now() < f.ends_at)
    from public.app_flags f where f.key = p_key
  ), false);
$$;

-- Le jour à Paris (un réglage de session permet de le simuler dans les tests SQL ; l'API ne peut pas le changer).
create function private.paris_today() returns date
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('nidoo.aujourdhui', true), '')::date, (now() at time zone 'Europe/Paris')::date);
$$;

create table public.advent_doors (
  family_id uuid not null references public.families (id) on delete cascade,
  year int not null,
  day int not null check (day between 1 and 24),
  opened_by uuid references public.members (id) on delete set null,
  opened_at timestamptz not null default now(),
  primary key (family_id, year, day)
);

alter table public.advent_doors enable row level security;
grant select on public.advent_doors to authenticated;
create policy advent_doors_select on public.advent_doors for select to authenticated using (private.is_member(family_id));

create function public.open_advent_door(p_family uuid, p_day int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  d date := private.paris_today();
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  if not private.flag_on('avent') then raise exception 'AVENT_FERME'; end if;
  if p_day is null or p_day < 1 or p_day > 24 then raise exception 'CASE_INCONNUE'; end if;
  if extract(month from d) <> 12 or extract(day from d) < p_day then raise exception 'CASE_PAS_ENCORE'; end if;
  insert into public.advent_doors (family_id, year, day, opened_by)
    values (p_family, extract(year from d)::int, p_day, me)
    on conflict do nothing;
  if found then
    perform private.award(p_family, me, 'avent', case when p_day = 24 then 3 else 1 end);
  end if;
end;
$$;

revoke execute on function public.open_advent_door(uuid, int) from public, anon;
revoke execute on function private.flag_on(text), private.paris_today() from public, anon;
grant execute on function public.open_advent_door(uuid, int) to authenticated;

alter publication supabase_realtime add table public.advent_doors;
