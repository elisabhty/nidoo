-- NIDOO — Le fil familial devient une discussion : photos (qu'on peut annoter avant l'envoi), texte, liens et vocaux.
-- Un vocal est un fichier audio dans le bucket privé « moments » (<family_id>/<uuid>.m4a ou .webm),
-- avec sa durée (secondes) et une petite onde (jusqu'à 64 hauteurs de 0 à 100) pour l'afficher sans le télécharger.
-- « X écrit… » passe par le canal privé de la famille (broadcast, rien n'est enregistré).

alter table public.moments
  add column audio_path text,
  add column duree smallint,
  add column ondes smallint[];

alter table public.moments drop constraint moments_check;
alter table public.moments drop constraint moments_body_check;
alter table public.moments
  add constraint moments_body_check check (body is null or char_length(body) <= 1000),
  add constraint moments_contenu check (image_path is not null or body is not null or audio_path is not null),
  add constraint moments_duree check (duree is null or duree between 1 and 300),
  add constraint moments_ondes check (ondes is null or cardinality(ondes) <= 64),
  add constraint moments_audio check (audio_path is null or audio_path like family_id::text || '/%');

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg']
where id = 'moments';
