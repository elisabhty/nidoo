-- 0010 : on s'occupe des animaux et des plantes du jardin, on répond à la question
-- du jour avec une photo, et les événements de l'agenda ont une description.

-- ───────────────────────── Soins du jardin ─────────────────────────
-- Le chat et les oiseaux se nourrissent (+3 étoiles), les fleurs et le potager
-- s'arrosent (+1). Une fois par jour pour toute la famille : le premier qui
-- s'en occupe fait gagner les étoiles à la maison.

create table public.house_care (
  family_id uuid not null references public.families (id) on delete cascade,
  item_key text not null check (item_key in ('chat', 'cabane', 'fleurs', 'potager')),
  -- le jour, à l'heure de Paris (posé par care_item, jamais par l'appli)
  day date not null,
  member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (family_id, item_key, day)
);
create index house_care_family_idx on public.house_care (family_id, day desc);

alter table public.house_care enable row level security;
grant select on public.house_care to authenticated;
create policy house_care_select on public.house_care for select to authenticated
  using (private.is_member(family_id));

create function public.care_item(p_family uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  amount int := case p_key when 'chat' then 3 when 'cabane' then 3 when 'fleurs' then 1 when 'potager' then 1 end;
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if amount is null then raise exception 'PAS_DE_SOIN'; end if;
  if not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = p_key) then
    raise exception 'PAS_INSTALLE';
  end if;
  insert into public.house_care (family_id, item_key, day, member_id) values (p_family, p_key, today, mid)
  on conflict do nothing;
  if not found then raise exception 'DEJA_FAIT'; end if;
  perform private.award(p_family, mid, 'soin:' || p_key, amount);
  return amount;
end;
$$;

revoke execute on function public.care_item(uuid, text) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.care_item(uuid, text) to authenticated;

alter publication supabase_realtime add table public.house_care;

-- ───────────────────────── Question du jour en photo ─────────────────────────
-- La photo va dans le bucket privé « moments » (<family_id>/<uuid>.jpg), lisible par la famille.
-- On peut répondre avec une photo seule, un texte seul, ou les deux.

alter table public.daily_answers
  add column photo_path text check (photo_path is null or photo_path like family_id::text || '/%');
alter table public.daily_answers drop constraint daily_answers_answer_check;
alter table public.daily_answers add constraint daily_answers_answer_check
  check (char_length(answer) <= 140 and (char_length(answer) >= 1 or photo_path is not null));

-- ───────────────────────── Description des événements ─────────────────────────

alter table public.events
  add column description text check (description is null or char_length(description) <= 500);

-- ───────────────────────── Qui est concerné ─────────────────────────
-- Les proches concernés par un événement (vide : toute la famille). La base ne garde
-- que des membres de la famille, dans l'ordre où ils sont arrivés.

alter table public.events
  add column members uuid[] not null default '{}' check (cardinality(members) <= 30);

create function private.event_members() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.members := coalesce(array(
    select m.id from public.members m
    where m.family_id = new.family_id and m.id = any(new.members)
    order by m.joined_at
  ), '{}');
  return new;
end;
$$;
create trigger events_members before insert or update of members on public.events
  for each row execute function private.event_members();

revoke execute on all functions in schema private from public, anon;
