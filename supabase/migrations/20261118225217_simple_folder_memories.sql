-- Les souvenirs enregistrés sont consultables et supprimables ; seules les notes écrites se modifient.
drop policy folder_items_update on public.folder_items;
create policy folder_items_update on public.folder_items for update to authenticated
using (private.in_folder(root_id) and kind = 'note')
with check (private.in_folder(root_id) and kind = 'note');

-- Aucun dossier imbriqué en production au moment de cette migration.
-- Refuser toute application qui masquerait un dossier existant.
do $$ begin
  if exists (select 1 from public.folders where parent_id is not null) then
    raise exception 'Flatten existing folders before enabling standalone folders';
  end if;
end $$;
alter table public.folders add constraint folders_standalone_check check (parent_id is null and root_id = id);
create or replace function public.create_folder(p_family uuid, p_name text, p_parent uuid default null, p_members uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid; fid uuid := gen_random_uuid();
begin
  if p_parent is not null then raise exception 'DOSSIERS_IMBRIQUES_INDISPONIBLES'; end if;
  me := private.my_member(p_family);
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  insert into public.folders (id, family_id, parent_id, root_id, owner_id, name)
    values (fid,p_family,null,fid,me,trim(p_name));
  insert into public.folder_members (folder_id,member_id,family_id)
    select fid,m.id,p_family from public.members m
    where m.family_id = p_family and (m.id = me or m.id = any(coalesce(p_members,'{}')));
  return fid;
end;
$$;
notify pgrst, 'reload schema';
