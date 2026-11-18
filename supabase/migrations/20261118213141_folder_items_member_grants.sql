-- Les politiques RLS réservent toujours chaque contenu aux membres du dossier.
grant insert, update on public.folder_items to authenticated;
notify pgrst, 'reload schema';
