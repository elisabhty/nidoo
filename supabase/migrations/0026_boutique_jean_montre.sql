-- NIDOO — Un jean large et une montre dorée à la boutique (prix alignés avec src/lib/data.ts).
-- Les personnages peuvent maintenant porter plusieurs choses à la fois (une place par type, voir PLACES
-- dans src/lib/look.ts) : rien à changer côté serveur, tout tient dans le champ « avatar ».
insert into private.shop_catalog (key, cost, qty) values ('mode:jean', 22, null), ('mode:montre', 20, null)
on conflict (key) do update set cost = excluded.cost, qty = excluded.qty;

-- de la marge pour le personnage, qui garde maintenant une tenue entière (jusqu'à ~90 caractères aujourd'hui)
alter table public.members drop constraint if exists members_avatar_len;
alter table public.members add constraint members_avatar_len check (char_length(avatar) between 1 and 200);
alter table public.join_requests drop constraint if exists join_requests_avatar_len;
alter table public.join_requests add constraint join_requests_avatar_len check (char_length(avatar) between 1 and 200);
