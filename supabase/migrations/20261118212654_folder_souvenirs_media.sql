-- Souvenirs privés des dossiers : dessins, vocaux, vidéos et provenance des photos du fil.
alter table public.folder_items
  add column if not exists media_path text,
  add column if not exists source_moment_id uuid references public.moments(id) on delete set null;
alter table public.folder_items drop constraint folder_items_kind_check;
alter table public.folder_items add constraint folder_items_kind_check check (kind in ('photo','note','message','dessin','audio','video'));
alter table public.folder_items drop constraint folder_items_check;
alter table public.folder_items add constraint folder_items_image_kind_check check ((kind in ('photo','dessin')) = (image_path is not null));
alter table public.folder_items add constraint folder_items_media_kind_check check ((kind in ('audio','video')) = (media_path is not null));
alter table public.folder_items add constraint folder_items_media_root_check check (media_path is null or media_path like root_id::text || '/%');
alter table public.folder_items add constraint folder_items_source_kind_check check (source_moment_id is null or kind = 'photo');
create index folder_items_source_moment_idx on public.folder_items(source_moment_id) where source_moment_id is not null;

create function private.folder_item_source_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.source_moment_id is not null and not exists (
    select 1 from public.moments m where m.id = new.source_moment_id and m.family_id = new.family_id and m.image_path is not null
  ) then
    raise exception 'PHOTO_DU_FIL_INACCESSIBLE';
  end if;
  return new;
end;
$$;
revoke all on function private.folder_item_source_check() from public;
create trigger folder_items_source_check before insert or update on public.folder_items
for each row execute function private.folder_item_source_check();

-- Même cercle de membres ; dessins collaboratifs comme les notes, remplacement par auteur ou administrateur.
drop policy folder_items_update on public.folder_items;
create policy folder_items_update on public.folder_items for update to authenticated
using (private.in_folder(root_id) and (kind in ('note','dessin') or author_id = private.my_member(family_id) or private.folder_admin(folder_id)))
with check (private.in_folder(root_id));

update storage.buckets set file_size_limit = greatest(coalesce(file_size_limit,0),26214400),
allowed_mime_types = array(select distinct unnest(coalesce(allowed_mime_types,array[]::text[]) || array[
'audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','audio/webm','audio/ogg','audio/wav','audio/x-wav','video/mp4','video/quicktime','video/webm']))
where id = 'dossiers';
-- Le bucket reste privé et toutes ses politiques d'accès par membres restent en place.
notify pgrst, 'reload schema';
