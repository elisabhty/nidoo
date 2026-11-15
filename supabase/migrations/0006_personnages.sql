-- NIDOO — Personnages
-- Les avatars animaux laissent la place à des personnages personnalisés (peau, coupe, couleur de cheveux,
-- yeux, lunettes, barbe, grain de beauté…). Ils sont rangés dans la colonne « avatar » existante,
-- sous une forme courte (« perso:s2.h5.c3… ») : on borne simplement sa longueur.

alter table public.members add constraint members_avatar_len check (char_length(avatar) between 1 and 100);
alter table public.join_requests add constraint join_requests_avatar_len check (char_length(avatar) between 1 and 100);
