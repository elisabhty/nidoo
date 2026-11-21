-- Une tâche (« À faire ») peut être liée à un événement de l'agenda (Elisa, 21 novembre).
-- Et seule la personne qui a ajouté un événement peut le modifier ou le supprimer, aussi côté serveur
-- (un événement dont l'auteur a quitté la maison — created_by remis à null — reste modifiable par tous).
-- Ajouts seulement : aucune donnée n'est effacée ni modifiée.

alter table public.list_items add column if not exists event_id uuid references public.events (id) on delete set null;
create index if not exists list_items_event_idx on public.list_items (event_id) where event_id is not null;

-- l'événement lié doit être de la même maison
create or replace function private.tache_meme_maison()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.event_id is not null and not exists (select 1 from public.events e where e.id = new.event_id and e.family_id = new.family_id) then
    raise exception 'EVENEMENT_AILLEURS';
  end if;
  return new;
end;
$$;
drop trigger if exists list_items_event_meme_maison on public.list_items;
create trigger list_items_event_meme_maison before insert or update of event_id, family_id on public.list_items
  for each row execute function private.tache_meme_maison();

-- les événements : tout le monde les voit et en ajoute ; seul l'auteur les modifie ou les supprime
drop policy if exists events_all on public.events;
drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_select on public.events for select using (private.is_member(family_id));
create policy events_insert on public.events for insert
  with check (private.is_member(family_id) and (created_by is null or created_by = private.my_member(family_id)));
create policy events_update on public.events for update
  using (private.is_member(family_id) and (created_by is null or created_by = private.my_member(family_id)))
  with check (private.is_member(family_id) and (created_by is null or created_by = private.my_member(family_id)));
create policy events_delete on public.events for delete
  using (private.is_member(family_id) and (created_by is null or created_by = private.my_member(family_id)));
