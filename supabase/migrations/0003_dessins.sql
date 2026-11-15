-- NIDOO — Dessins en direct (widget moyen)
-- Un dessin part vers un proche (to_member) ou vers toute la famille (to_member vide).
-- Il est enregistré trait par trait, pour se redessiner sous les yeux de celui qui le reçoit.
--
-- data = { "v": 1, "bg": "#FFFFFF", "s": [ { "o": "crayon" | "feutre" | "gomme", "c": "#RRGGBB", "w": 12, "p": [x, y, x, y, …] } ] }
-- Coordonnées entières sur une feuille de 1000 × 467, la forme d'un widget moyen d'iPhone.

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  from_member uuid not null references public.members (id) on delete cascade,
  to_member uuid references public.members (id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data -> 's') = 'array'
    and jsonb_array_length(data -> 's') between 1 and 800
    and octet_length(data::text) <= 262144
  ),
  created_at timestamptz not null default now(),
  check (to_member is null or to_member <> from_member)
);
create index drawings_family_idx on public.drawings (family_id, created_at desc);
create index drawings_to_idx on public.drawings (to_member, created_at desc);

-- Une étoile par dessin envoyé, cinq par jour au maximum.
create function private.on_drawing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award(new.family_id, new.from_member, 'dessin', 1, 5);
  return new;
end; $$;
create trigger drawings_stars after insert on public.drawings for each row execute function private.on_drawing();

alter table public.drawings enable row level security;
grant select, delete on public.drawings to authenticated;
grant insert (family_id, from_member, to_member, data) on public.drawings to authenticated;

-- On voit les dessins envoyés à toute la famille, ceux qu'on a reçus et ceux qu'on a faits.
create policy drawings_select on public.drawings for select to authenticated
  using (
    private.is_member(family_id)
    and (to_member is null or private.my_member(family_id) in (from_member, to_member))
  );
create policy drawings_insert on public.drawings for insert to authenticated
  with check (
    from_member = private.my_member(family_id)
    and (to_member is null or exists (select 1 from public.members m where m.id = to_member and m.family_id = drawings.family_id))
  );
create policy drawings_delete on public.drawings for delete to authenticated
  using (from_member = private.my_member(family_id));

alter publication supabase_realtime add table public.drawings;
