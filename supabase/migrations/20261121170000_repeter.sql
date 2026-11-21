-- « Répéter » avec plusieurs rythmes (Elisa, 21 novembre) : chaque jour, chaque semaine, toutes les 2 semaines,
-- chaque mois, chaque année. weekly et yearly restent remplis pour « semaine » et « annee » (anciennes versions).
alter table public.events
  add column if not exists repete text
  check (repete in ('jour', 'semaine', '2semaines', 'mois', 'annee'));
