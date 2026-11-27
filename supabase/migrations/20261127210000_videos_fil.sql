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
