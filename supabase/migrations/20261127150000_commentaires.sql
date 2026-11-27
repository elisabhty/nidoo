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
