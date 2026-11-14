-- NIDOO : dossiers de moments, partagés avec la famille ou privés (visibles par leur créateur seulement).

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references public.members (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
create index folders_family_idx on public.folders (family_id, created_at);

alter table public.moments add column folder_id uuid references public.folders (id) on delete set null;
create index moments_folder_idx on public.moments (folder_id);

-- Un dossier est visible s'il est partagé dans ma famille, ou s'il est à moi.
create function private.can_see_folder(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folders f
    where f.id = fid
      and private.is_member(f.family_id)
      and (not f.is_private or f.owner_id = private.my_member(f.family_id))
  );
$$;

-- Peut-on ranger un moment de cette famille dans ce dossier ?
create function private.folder_ok(fid uuid, fam uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select fid is null or exists (
    select 1 from public.folders f
    where f.id = fid and f.family_id = fam
      and (not f.is_private or f.owner_id = private.my_member(fam))
  );
$$;
revoke execute on function private.can_see_folder(uuid), private.folder_ok(uuid, uuid) from public, anon;
grant execute on function private.can_see_folder(uuid), private.folder_ok(uuid, uuid) to authenticated;

alter table public.folders enable row level security;
revoke all on public.folders from anon, authenticated;
grant select, insert, delete on public.folders to authenticated;
grant update (name, is_private) on public.folders to authenticated;

create policy folders_select on public.folders for select to authenticated
  using (private.is_member(family_id) and (not is_private or owner_id = private.my_member(family_id)));
create policy folders_insert on public.folders for insert to authenticated
  with check (owner_id = private.my_member(family_id));
create policy folders_update on public.folders for update to authenticated
  using (owner_id = private.my_member(family_id)) with check (owner_id = private.my_member(family_id));
create policy folders_delete on public.folders for delete to authenticated
  using (owner_id = private.my_member(family_id));

-- Les moments d'un dossier privé ne sont lus que par son propriétaire.
drop policy moments_select on public.moments;
create policy moments_select on public.moments for select to authenticated
  using (private.is_member(family_id) and (folder_id is null or private.can_see_folder(folder_id)));
drop policy moments_insert on public.moments;
create policy moments_insert on public.moments for insert to authenticated
  with check (member_id = private.my_member(family_id) and private.folder_ok(folder_id, family_id));
grant update (folder_id) on public.moments to authenticated;
create policy moments_update on public.moments for update to authenticated
  using (member_id = private.my_member(family_id))
  with check (member_id = private.my_member(family_id) and private.folder_ok(folder_id, family_id));

-- Un moment privé ne rapporte pas d'étoiles à la maison.
create or replace function private.on_moment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.folder_id is null or not exists (select 1 from public.folders f where f.id = new.folder_id and f.is_private) then
    perform private.award(new.family_id, new.member_id, 'moment', 3, 5);
  end if;
  return new;
end; $$;

-- Rendre un dossier privé renvoie les moments des autres dans le fil de la famille.
create function private.on_folder_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_private and not old.is_private then
    update public.moments set folder_id = null where folder_id = new.id and member_id <> new.owner_id;
  end if;
  return new;
end; $$;
create trigger folders_privacy after update on public.folders for each row execute function private.on_folder_update();

-- Supprimer un dossier privé supprime ses moments (ils ne doivent jamais devenir visibles) ;
-- ceux d'un dossier partagé retournent simplement dans le fil.
create function private.on_folder_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_private then
    delete from public.moments where folder_id = old.id;
  end if;
  return old;
end; $$;
create trigger folders_cleanup before delete on public.folders for each row execute function private.on_folder_delete();

-- Les photos suivent la visibilité de leur moment : on ne lit un fichier que si on peut lire le moment.
drop policy moments_photos_select on storage.objects;
create policy moments_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'moments' and (
    owner_id = (select auth.uid())::text
    or exists (select 1 from public.moments m where m.image_path = name)
  ));

alter publication supabase_realtime add table public.folders;
