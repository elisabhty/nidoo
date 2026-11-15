-- NIDOO — Photo ou dessin : un seul widget
-- Un « instant » est un dessin qui peut avoir une photo en fond : une photo seule, une photo dessinée
-- ou un dessin seul. Même envoi (un proche ou toute la famille), même réception en direct.
-- La photo va dans un bucket privé « instants », lisible seulement par ceux qui voient l'instant.

alter table public.drawings add column photo_path text check (photo_path is null or photo_path like family_id::text || '/%');
alter table public.drawings drop constraint drawings_data_check;
alter table public.drawings add constraint drawings_data_check check (
  jsonb_typeof(data) = 'object'
  and jsonb_typeof(data -> 's') = 'array'
  and jsonb_array_length(data -> 's') <= 800
  and octet_length(data::text) <= 262144
  and (photo_path is not null or jsonb_array_length(data -> 's') >= 1)
);
grant insert (photo_path) on public.drawings to authenticated;

-- Peut-on voir la photo de cet instant ? (les mêmes règles que l'instant lui-même)
create function private.can_see_instant(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.drawings d
    where d.photo_path = p
      and private.is_member(d.family_id)
      and (d.to_member is null or private.my_member(d.family_id) in (d.from_member, d.to_member))
  );
$$;
grant execute on function private.can_see_instant(text) to authenticated;

create function private.family_of_path(p text) returns uuid
language sql immutable set search_path = '' as $$
  select case when (storage.foldername(p))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(p))[1])::uuid end;
$$;
grant execute on function private.family_of_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instants', 'instants', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy instants_select on storage.objects for select to authenticated
  using (bucket_id = 'instants' and private.can_see_instant(name));
create policy instants_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'instants' and private.is_member(private.family_of_path(name)));
create policy instants_delete on storage.objects for delete to authenticated
  using (bucket_id = 'instants' and owner_id = (select auth.uid())::text);

-- Étoiles : une photo rapporte comme une photo (3), un dessin seul comme un dessin (1).
create or replace function private.on_drawing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_path is not null then
    perform private.award(new.family_id, new.from_member, 'moment', 3, 5);
  else
    perform private.award(new.family_id, new.from_member, 'dessin', 1, 5);
  end if;
  return new;
end; $$;

-- Défi de la semaine : les photos des instants comptent comme des photos ; un dessin compte s'il y a des traits.
create or replace function private.weekly_counts(fid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (select private.week_start() as s)
  select jsonb_build_object(
    'photos', (select count(*) from public.moments m, w where m.family_id = fid and m.image_path is not null and m.created_at >= w.s)
            + (select count(*) from public.folder_items i, w where i.family_id = fid and i.kind = 'photo' and i.created_at >= w.s)
            + (select count(*) from public.drawings d, w where d.family_id = fid and d.photo_path is not null and d.created_at >= w.s),
    'calins', (select count(*) from public.thoughts t, w where t.family_id = fid and t.created_at >= w.s),
    'dessins', (select count(*) from public.drawings d, w where d.family_id = fid and jsonb_array_length(d.data -> 's') > 0 and d.created_at >= w.s),
    'missions', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'mission' and x.created_at >= w.s),
    'humeurs', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'humeur' and x.created_at >= w.s),
    'questions', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'question' and x.created_at >= w.s)
  );
$$;

revoke execute on all functions in schema private from public, anon;
