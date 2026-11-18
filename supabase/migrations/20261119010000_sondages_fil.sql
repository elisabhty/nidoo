-- NIDOO — Sondages intégrés au fil familial (2 à 6 réponses, un vote par proche).
alter table public.moments
  add column poll_options text[] default null;

-- Validation de chaque réponse par une fonction immuable.
create function private.valid_poll_options(choices text[])
returns boolean language sql immutable set search_path = '' as $$
  select choices is null or (
    cardinality(choices) between 2 and 6
    and not exists (
      select 1 from unnest(choices) c
      where c is null or char_length(btrim(c)) not between 1 and 80
    )
    and (select count(distinct lower(btrim(c))) from unnest(choices) c) = cardinality(choices)
  )
$$;

alter table public.moments drop constraint moments_poll_options_valid;
alter table public.moments
  add constraint moments_poll_options_valid check (
    private.valid_poll_options(poll_options)
    and (poll_options is null or (body is not null and char_length(btrim(body)) between 1 and 200))
  );

create table public.poll_votes (
  moment_id uuid not null references public.moments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (moment_id, member_id)
);
create index poll_votes_family_idx on public.poll_votes (family_id);
alter table public.poll_votes enable row level security;
grant select, insert, update on public.poll_votes to authenticated;

create policy poll_votes_select on public.poll_votes for select to authenticated
  using (private.is_member(family_id));

create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check (
    member_id = private.my_member(family_id)
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and m.family_id = poll_votes.family_id
        and m.poll_options is not null and option_index < cardinality(m.poll_options)
    )
  );

create policy poll_votes_update on public.poll_votes for update to authenticated
  using (member_id = private.my_member(family_id))
  with check (
    member_id = private.my_member(family_id)
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and m.family_id = poll_votes.family_id
        and m.poll_options is not null and option_index < cardinality(m.poll_options)
    )
  );

-- Les votes sont actualisés sur tous les appareils connectés.
alter publication supabase_realtime add table public.poll_votes;
