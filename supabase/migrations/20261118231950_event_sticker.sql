-- Sticker facultatif pour l’icône d’un événement ; les anciens événements gardent leur icône de type.
alter table public.events add column sticker text;
alter table public.events add constraint events_sticker_key_check check (sticker is null or sticker ~ '^[a-z][a-z0-9-]{0,39}$');
-- Les autorisations et la politique existante restent limitées aux membres de la famille.
notify pgrst, 'reload schema';
