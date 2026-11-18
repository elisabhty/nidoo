-- Le lieu d'un événement (affiché dans l'agenda et ouvrable dans Plans),
-- et les stickers envoyés dans le fil familial.

alter table public.events
  add column if not exists lieu text check (lieu is null or char_length(lieu) <= 200);

alter table public.moments
  add column if not exists sticker text check (sticker is null or (char_length(sticker) between 1 and 60 and sticker !~ '[<>"\\]'));

alter table public.moments drop constraint if exists moments_contenu;
alter table public.moments
  add constraint moments_contenu check (image_path is not null or body is not null or audio_path is not null or sticker is not null);
