-- NIDOO — Toute la famille voit tout (Elisa, 28 novembre : « quand tu es dans la famille, tu peux voir tout »).
-- Les albums ne sont plus réservés à quelques proches : chaque membre de la famille voit tous les albums, ce qu'ils
-- contiennent et leurs fichiers, et peut y ajouter des souvenirs, y compris ceux qui rejoindront la famille plus tard.
-- Le créateur d'un album reste le seul à pouvoir le renommer ou le supprimer ; chacun supprime ce qu'il a ajouté.
-- (Toutes les règles d'accès aux albums passent par cette seule fonction : il suffit de la changer.)
create or replace function private.in_folder(rid uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.folders f
    join public.members m on m.family_id = f.family_id
    where f.id = rid and m.user_id = (select auth.uid())
  );
$$;
