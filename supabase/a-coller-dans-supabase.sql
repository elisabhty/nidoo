-- NIDOO — À coller dans Supabase : SQL Editor › New query › coller tout › Run.
-- Quatre changements, sans rien effacer. On peut le relancer sans risque : chaque partie vérifie ce qui existe déjà.

-- ═══════════ 1. Les vidéos dans le fil ═══════════
-- NIDOO — Des vidéos dans le fil (Elisa, 27 novembre : « optimiser les vidéos, pour la partie fil surtout »).
-- Le téléphone prépare la vidéo avant l'envoi (720p, ~2 Mbit/s, la première minute au plus) : elle pèse 3 à 4 fois
-- moins. Elle va dans le même espace privé que les photos du fil (bucket « moments », lisible par la maison seulement),
-- avec une image (l'affiche) pour la montrer dans le fil sans télécharger la vidéo. Sa durée va dans « duree ».

alter table public.moments
  add column if not exists video_path text,
  add column if not exists poster_path text;

alter table public.moments drop constraint if exists moments_video;
alter table public.moments
  add constraint moments_video check (
    (video_path is null or video_path like family_id::text || '/%')
    and (poster_path is null or poster_path like family_id::text || '/%')
    and (poster_path is null or video_path is not null)
  );

-- une publication peut n'être qu'une vidéo
alter table public.moments drop constraint if exists moments_contenu;
alter table public.moments
  add constraint moments_contenu check (image_path is not null or body is not null or audio_path is not null or sticker is not null or video_path is not null);

-- l'espace des photos du fil accepte aussi les vidéos (25 Mo au plus : une vidéo que le téléphone n'a pas su préparer)
update storage.buckets
set allowed_mime_types = array(
      select distinct unnest(coalesce(allowed_mime_types, array[]::text[]) || array['video/mp4', 'video/quicktime'])
    ),
    file_size_limit = greatest(coalesce(file_size_limit, 0), 26214400)
where id = 'moments';

-- ═══════════ 2. Les commentaires du fil ═══════════
-- NIDOO — Le fil devient un fil d'actualité, façon Facebook (Elisa, 27 novembre) : on commente une publication.
-- Un commentaire est un moment qui répond à une publication de la même maison (reply_to) ; il ne répond pas à un
-- autre commentaire. Supprimer la publication supprime ses commentaires (et leurs réactions, déjà en cascade).
-- Rien d'autre ne change : mêmes droits de lecture et d'écriture que les publications (la maison seulement).

alter table public.moments
  add column if not exists reply_to uuid references public.moments (id) on delete cascade;

create index if not exists moments_reply_to_idx on public.moments (reply_to) where reply_to is not null;

create or replace function private.verifier_commentaire() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.reply_to is not null and not exists (
    select 1 from public.moments p
    where p.id = new.reply_to and p.family_id = new.family_id and p.reply_to is null
  ) then
    raise exception 'COMMENTAIRE_INVALIDE';
  end if;
  return new;
end; $$;

drop trigger if exists moments_commentaire on public.moments;
create trigger moments_commentaire before insert on public.moments
  for each row execute function private.verifier_commentaire();

-- ═══════════ 3. La corbeille de 30 jours ═══════════
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

-- ═══════════ 4. Toute la famille voit tous les albums ═══════════
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
