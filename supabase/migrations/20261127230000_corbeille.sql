-- NIDOO — La corbeille de 30 jours, « Supprimés récemment » (Elisa, 27 novembre) : supprimer une publication, un
-- souvenir d'album ou un album ne l'efface plus tout de suite. Il disparaît pour toute la famille, mais celui ou celle
-- qui l'a supprimé le retrouve pendant 30 jours et peut le remettre. Ensuite il est effacé pour de bon (par l'appli de
-- la personne, et chaque nuit par la sauvegarde : scripts/sauvegarde.mjs).
-- Les droits ne changent pas : on met à la corbeille ce qu'on avait le droit de supprimer.

alter table public.moments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;
alter table public.folder_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;
alter table public.folders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists moments_corbeille_idx on public.moments (deleted_at) where deleted_at is not null;
create index if not exists folder_items_corbeille_idx on public.folder_items (deleted_at) where deleted_at is not null;
create index if not exists folders_corbeille_idx on public.folders (deleted_at) where deleted_at is not null;

-- Ce qui est à la corbeille n'est plus visible que par la personne qui l'y a mis.
drop policy if exists moments_select on public.moments;
create policy moments_select on public.moments for select to authenticated
  using (private.is_member(family_id) and (deleted_at is null or deleted_by = private.my_member(family_id)));

drop policy if exists folders_select on public.folders;
create policy folders_select on public.folders for select to authenticated
  using (private.in_folder(root_id) and (deleted_at is null or deleted_by = private.my_member(family_id)));

drop policy if exists folder_items_select on public.folder_items;
create policy folder_items_select on public.folder_items for select to authenticated
  using (private.in_folder(root_id) and (deleted_at is null or deleted_by = private.my_member(family_id)));

-- Mettre à la corbeille : mêmes droits que pour supprimer.
create or replace function public.corbeille_jeter(p_table text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_table = 'moments' then
    update public.moments m set deleted_at = now(), deleted_by = m.member_id
     where m.id = p_id and m.deleted_at is null and m.member_id = private.my_member(m.family_id);
  elsif p_table = 'folder_items' then
    update public.folder_items i set deleted_at = now(), deleted_by = private.my_member(i.family_id)
     where i.id = p_id and i.deleted_at is null and private.in_folder(i.root_id)
       and (i.author_id = private.my_member(i.family_id) or private.folder_admin(i.folder_id));
  elsif p_table = 'folders' then
    update public.folders f set deleted_at = now(), deleted_by = private.my_member(f.family_id)
     where f.id = p_id and f.deleted_at is null and private.folder_admin(f.id);
  else
    raise exception 'CORBEILLE_INVALIDE';
  end if;
  if not found then raise exception 'CORBEILLE_REFUSEE'; end if;
end; $$;

-- Remettre : seulement ce qu'on a soi-même mis à la corbeille, il y a moins de 30 jours, et qu'on a encore le droit
-- de toucher (un album qu'on a quitté entre-temps, par exemple, n'est plus à soi).
create or replace function public.corbeille_restaurer(p_table text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_table = 'moments' then
    update public.moments m set deleted_at = null, deleted_by = null
     where m.id = p_id and m.deleted_at > now() - interval '30 days' and m.deleted_by = private.my_member(m.family_id);
  elsif p_table = 'folder_items' then
    update public.folder_items i set deleted_at = null, deleted_by = null
     where i.id = p_id and i.deleted_at > now() - interval '30 days' and i.deleted_by = private.my_member(i.family_id)
       and private.in_folder(i.root_id);
  elsif p_table = 'folders' then
    update public.folders f set deleted_at = null, deleted_by = null
     where f.id = p_id and f.deleted_at > now() - interval '30 days' and f.deleted_by = private.my_member(f.family_id)
       and private.in_folder(f.root_id);
  else
    raise exception 'CORBEILLE_INVALIDE';
  end if;
  if not found then raise exception 'CORBEILLE_REFUSEE'; end if;
end; $$;

revoke all on function public.corbeille_jeter(text, uuid) from public, anon;
revoke all on function public.corbeille_restaurer(text, uuid) from public, anon;
grant execute on function public.corbeille_jeter(text, uuid) to authenticated;
grant execute on function public.corbeille_restaurer(text, uuid) to authenticated;
