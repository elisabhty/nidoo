-- La sélection commune utilise des identifiants stables, jamais les URL signées des images.
alter table public.families add column house_photo_ids text[] default null;
alter table public.families add constraint families_house_photos_count check (house_photo_ids is null or cardinality(house_photo_ids) <= 6);
grant update (house_photo_ids) on public.families to authenticated;
-- La politique existante limite la lecture et la modification aux membres de la famille.
notify pgrst, 'reload schema';
