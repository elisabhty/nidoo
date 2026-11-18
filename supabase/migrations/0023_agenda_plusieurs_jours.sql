-- Agenda : un événement peut durer plusieurs jours (week-end, vacances) et revenir chaque semaine
-- (activités des enfants). Les anniversaires gardent « yearly ».

alter table public.events
  add column if not exists ends_on date,
  add column if not exists weekly boolean not null default false;

alter table public.events
  add constraint events_ends_on check (ends_on is null or ends_on >= (starts_at at time zone 'UTC')::date - 1),
  add constraint events_une_repetition check (not (weekly and yearly));
