-- NIDOO : dossiers.
-- Un dossier « racine » a ses membres : eux seuls le voient, avec ses sous-dossiers,
-- ses photos, ses notes et sa discussion. Les sous-dossiers ont les membres de leur racine.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  root_id uuid not null,
  owner_id uuid references public.members (id) on delete set null,
  name text not null check (char_length(name) between 1 and 40),
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cover_path is null or cover_path like root_id::text || '/%')
);
create index folders_family_idx on public.folders (family_id);
create index folders_root_idx on public.folders (root_id);
create index folders_parent_idx on public.folders (parent_id);

create table public.folder_members (
  folder_id uuid not null references public.folders (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (folder_id, member_id)
);
create index folder_members_member_idx on public.folder_members (member_id);
create index folder_members_family_idx on public.folder_members (family_id);

create table public.folder_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  root_id uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  author_id uuid references public.members (id) on delete set null,
  kind text not null check (kind in ('photo', 'note', 'message')),
  title text check (title is null or char_length(title) <= 80),
  body text check (body is null or char_length(body) <= 4000),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'photo') = (image_path is not null)),
  check (image_path is null or image_path like root_id::text || '/%'),
  check (kind <> 'message' or char_length(coalesce(body, '')) between 1 and 1000)
);
create index folder_items_folder_idx on public.folder_items (folder_id, created_at);
create index folder_items_root_idx on public.folder_items (root_id);
create index folder_items_family_idx on public.folder_items (family_id);

-- ───────────────────────── Fonctions internes ─────────────────────────

-- Suis-je membre de ce dossier racine ?
create function private.in_folder(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folder_members fm
    join public.members m on m.id = fm.member_id
    where fm.folder_id = rid and m.user_id = (select auth.uid())
  );
$$;

-- Le chemin d'un fichier commence par l'identifiant de son dossier racine.
create function private.in_folder_path(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(p, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.in_folder(split_part(p, '/', 1)::uuid)
    else false
  end;
$$;

-- Peut administrer un dossier : son créateur, le créateur de sa racine,
-- ou n'importe quel membre si ce créateur a quitté la famille.
create function private.folder_admin(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.folders f
    join public.folders r on r.id = f.root_id
    where f.id = fid
      and private.in_folder(f.root_id)
      and (r.owner_id is null
        or r.owner_id = private.my_member(r.family_id)
        or f.owner_id = private.my_member(f.family_id))
  );
$$;

create function private.folder_owner(fid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select f.owner_id from public.folders f where f.id = fid;
$$;

revoke execute on function private.in_folder(uuid), private.in_folder_path(text), private.folder_admin(uuid), private.folder_owner(uuid) from public, anon;
grant execute on function private.in_folder(uuid), private.in_folder_path(text), private.folder_admin(uuid), private.folder_owner(uuid) to authenticated;

-- ───────────────────────── Triggers ─────────────────────────

create function private.touch_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;
create trigger folders_updated before update on public.folders for each row execute function private.touch_updated();
create trigger folder_items_updated before update on public.folder_items for each row execute function private.touch_updated();

-- Un élément prend la racine et la famille de son dossier (le client ne peut pas tricher).
create function private.folder_item_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  f public.folders%rowtype;
begin
  select * into f from public.folders where id = new.folder_id;
  if not found then raise exception 'DOSSIER_INCONNU'; end if;
  new.root_id := f.root_id;
  new.family_id := f.family_id;
  new.created_at := now();
  new.updated_at := now();
  return new;
end; $$;
create trigger folder_items_before_insert before insert on public.folder_items for each row execute function private.folder_item_before_insert();

-- Toute activité fait remonter le dossier dans la liste.
create function private.folder_item_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.folders set updated_at = now() where id = new.folder_id;
  return null;
end; $$;
create trigger folder_items_touch after insert or update on public.folder_items for each row execute function private.folder_item_touch();

-- Une photo supprimée ne peut plus servir de couverture.
create function private.folder_item_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.image_path is not null then
    update public.folders set cover_path = null where root_id = old.root_id and cover_path = old.image_path;
  end if;
  return old;
end; $$;
create trigger folder_items_after_delete after delete on public.folder_items for each row execute function private.folder_item_after_delete();

-- ───────────────────────── RPC ─────────────────────────

-- Crée un dossier racine (avec ses membres) ou un sous-dossier (qui hérite des membres).
create function public.create_folder(p_family uuid, p_name text, p_parent uuid default null, p_members uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid;
  fid uuid := gen_random_uuid();
  par public.folders%rowtype;
begin
  if p_parent is not null then
    select * into par from public.folders where id = p_parent;
    if not found or not private.in_folder(par.root_id) then raise exception 'DOSSIER_INCONNU'; end if;
    p_family := par.family_id;
  end if;
  me := private.my_member(p_family);
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  insert into public.folders (id, family_id, parent_id, root_id, owner_id, name)
    values (fid, p_family, p_parent, coalesce(par.root_id, fid), me, trim(p_name));
  if p_parent is null then
    insert into public.folder_members (folder_id, member_id, family_id)
      select fid, m.id, p_family from public.members m
      where m.family_id = p_family and (m.id = me or m.id = any (coalesce(p_members, '{}')));
  else
    update public.folders set updated_at = now() where id = p_parent;
  end if;
  return fid;
end;
$$;

-- Fixe la liste des membres d'un dossier racine. Le créateur, et l'administrateur qui agit, restent dedans.
create function public.set_folder_members(p_folder uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  f public.folders%rowtype;
begin
  select * into f from public.folders where id = p_folder;
  if not found or f.parent_id is not null then raise exception 'DOSSIER_INCONNU'; end if;
  if not private.folder_admin(p_folder) then raise exception 'PAS_ADMIN'; end if;
  delete from public.folder_members fm
    where fm.folder_id = p_folder
      and fm.member_id is distinct from f.owner_id
      and fm.member_id is distinct from private.my_member(f.family_id)
      and not (fm.member_id = any (coalesce(p_members, '{}')));
  insert into public.folder_members (folder_id, member_id, family_id)
    select p_folder, m.id, f.family_id from public.members m
    where m.family_id = f.family_id and m.id = any (coalesce(p_members, '{}'))
    on conflict do nothing;
end;
$$;

revoke execute on function public.create_folder(uuid, text, uuid, uuid[]), public.set_folder_members(uuid, uuid[]) from public, anon;
grant execute on function public.create_folder(uuid, text, uuid, uuid[]), public.set_folder_members(uuid, uuid[]) to authenticated;

-- ───────────────────────── Droits et RLS ─────────────────────────

alter table public.folders enable row level security;
alter table public.folder_members enable row level security;
alter table public.folder_items enable row level security;

revoke all on public.folders, public.folder_members, public.folder_items from anon, authenticated;
grant select, delete on public.folders to authenticated;
grant update (name, cover_path) on public.folders to authenticated;
grant select, delete on public.folder_members to authenticated;
grant select, delete on public.folder_items to authenticated;
grant insert (folder_id, author_id, kind, title, body, image_path) on public.folder_items to authenticated;
grant update (title, body) on public.folder_items to authenticated;

-- On ne voit que les dossiers dont on est membre.
create policy folders_select on public.folders for select to authenticated
  using (private.in_folder(root_id));
create policy folders_update on public.folders for update to authenticated
  using (private.folder_admin(id)) with check (private.folder_admin(id));
create policy folders_delete on public.folders for delete to authenticated
  using (private.folder_admin(id));

-- On voit qui est avec nous ; on peut quitter un dossier (sauf celui qu'on a créé).
create policy folder_members_select on public.folder_members for select to authenticated
  using (private.in_folder(folder_id));
create policy folder_members_delete on public.folder_members for delete to authenticated
  using (member_id = private.my_member(family_id) and member_id is distinct from private.folder_owner(folder_id));

-- Photos, notes et messages : réservés aux membres. Les notes sont modifiables par tous les membres,
-- le reste par son auteur ; l'administrateur peut tout retirer.
create policy folder_items_select on public.folder_items for select to authenticated
  using (private.in_folder(root_id));
create policy folder_items_insert on public.folder_items for insert to authenticated
  with check (author_id = private.my_member(family_id) and private.in_folder(root_id));
create policy folder_items_update on public.folder_items for update to authenticated
  using (private.in_folder(root_id) and (kind = 'note' or author_id = private.my_member(family_id)))
  with check (private.in_folder(root_id));
create policy folder_items_delete on public.folder_items for delete to authenticated
  using (private.in_folder(root_id) and (author_id = private.my_member(family_id) or private.folder_admin(folder_id)));

-- ───────────────────────── Fichiers (bucket privé) ─────────────────────────
-- Chemin : <id du dossier racine>/<fichier> — lisible uniquement par les membres du dossier.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dossiers', 'dossiers', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy dossiers_select on storage.objects for select to authenticated
  using (bucket_id = 'dossiers' and private.in_folder_path(name));
create policy dossiers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dossiers' and private.in_folder_path(name));
create policy dossiers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dossiers' and private.in_folder_path(name));

-- ───────────────────────── Temps réel ─────────────────────────

alter publication supabase_realtime add table public.folders, public.folder_members, public.folder_items;
