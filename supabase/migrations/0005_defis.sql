-- NIDOO — Défi de la semaine
-- Un objectif commun à toute la famille, qui change chaque lundi (heure UTC).
-- La progression est comptée par la base ; la récompense (une décoration offerte, sinon 20 étoiles)
-- ne peut être reçue qu'une fois par semaine et seulement si le défi est vraiment relevé.
-- Les objectifs doivent rester alignés avec src/lib/weekly.ts.

create table public.weekly_rewards (
  family_id uuid not null references public.families (id) on delete cascade,
  week date not null,
  reward text not null,
  claimed_by uuid references public.members (id) on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (family_id, week)
);
alter table public.weekly_rewards enable row level security;
grant select on public.weekly_rewards to authenticated;
create policy weekly_rewards_select on public.weekly_rewards for select to authenticated
  using (private.is_member(family_id));

-- Lundi 0 h UTC de la semaine en cours.
create function private.week_start() returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
$$;

create function private.week_index() returns int
language sql stable set search_path = '' as $$
  select (floor(extract(epoch from date_trunc('week', now() at time zone 'UTC')) / 604800))::int % 4;
$$;

create function private.weekly_goals(i int) returns jsonb
language sql immutable set search_path = '' as $$
  select (array[
    '{"photos": 3, "calins": 5, "missions": 3}',
    '{"dessins": 3, "humeurs": 8, "questions": 4}',
    '{"calins": 6, "humeurs": 10, "photos": 2}',
    '{"missions": 5, "dessins": 2, "questions": 3}'
  ]::jsonb[])[i + 1];
$$;

-- Ce que toute la famille a fait depuis lundi.
create function private.weekly_counts(fid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (select private.week_start() as s)
  select jsonb_build_object(
    'photos', (select count(*) from public.moments m, w where m.family_id = fid and m.image_path is not null and m.created_at >= w.s)
            + (select count(*) from public.folder_items i, w where i.family_id = fid and i.kind = 'photo' and i.created_at >= w.s),
    'calins', (select count(*) from public.thoughts t, w where t.family_id = fid and t.created_at >= w.s),
    'dessins', (select count(*) from public.drawings d, w where d.family_id = fid and d.created_at >= w.s),
    'missions', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'mission' and x.created_at >= w.s),
    'humeurs', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'humeur' and x.created_at >= w.s),
    'questions', (select count(*) from public.star_log x, w where x.family_id = fid and x.reason = 'question' and x.created_at >= w.s)
  );
$$;

create function public.weekly_challenge(p_family uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_member(p_family) then raise exception 'PAS_MEMBRE'; end if;
  return jsonb_build_object(
    'counts', private.weekly_counts(p_family),
    'claimed', (select r.reward from public.weekly_rewards r
                where r.family_id = p_family and r.week = (date_trunc('week', now() at time zone 'UTC'))::date)
  );
end;
$$;

create function public.claim_weekly(p_family uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  wk date := (date_trunc('week', now() at time zone 'UTC'))::date;
  goals jsonb := private.weekly_goals(private.week_index());
  counts jsonb;
  k text;
  reward text;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  -- Un seul passage à la fois par famille : pas de double récompense.
  perform 1 from public.families f where f.id = p_family for update;
  if exists (select 1 from public.weekly_rewards r where r.family_id = p_family and r.week = wk) then
    raise exception 'DEFI_DEJA_RECU';
  end if;
  counts := private.weekly_counts(p_family);
  for k in select jsonb_object_keys(goals) loop
    if coalesce((counts ->> k)::int, 0) < (goals ->> k)::int then raise exception 'DEFI_INCOMPLET'; end if;
  end loop;
  select c.key into reward from public.house_catalog c
    where not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = c.key)
    order by c.cost limit 1;
  if reward is not null then
    insert into public.house_items (family_id, item_key, unlocked_by) values (p_family, reward, mid);
    insert into public.star_log (family_id, member_id, reason, amount) values (p_family, mid, 'defi', 0);
  else
    reward := 'etoiles';
    perform private.award(p_family, mid, 'defi', 20);
  end if;
  insert into public.weekly_rewards (family_id, week, reward, claimed_by) values (p_family, wk, reward, mid);
  return reward;
end;
$$;

revoke execute on function public.weekly_challenge(uuid), public.claim_weekly(uuid) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.weekly_challenge(uuid) to authenticated;
grant execute on function public.claim_weekly(uuid) to authenticated;

alter publication supabase_realtime add table public.weekly_rewards;
