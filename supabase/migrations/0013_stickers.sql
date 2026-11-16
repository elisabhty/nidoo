-- NIDOO — Stickers sur les dessins et les photos
-- Un instant peut maintenant n'avoir que des stickers sur le papier (data.k), sans trait ni photo.
-- On limite leur nombre comme on limite les traits.

alter table public.drawings drop constraint drawings_data_check;
alter table public.drawings add constraint drawings_data_check check (
  jsonb_typeof(data) = 'object'
  and jsonb_typeof(data -> 's') = 'array'
  and jsonb_array_length(data -> 's') <= 800
  and (data -> 'k' is null or (jsonb_typeof(data -> 'k') = 'array' and jsonb_array_length(data -> 'k') <= 40))
  and octet_length(data::text) <= 262144
  and (
    photo_path is not null
    or jsonb_array_length(data -> 's') >= 1
    or coalesce(jsonb_array_length(case when jsonb_typeof(data -> 'k') = 'array' then data -> 'k' end), 0) >= 1
  )
);
