-- NIDOO : schéma complet (familles, membres, moments, attentions, agenda, listes, étoiles, maison)
-- Tout passe par RLS : on ne voit que les données des familles dont on est membre.

create extension if not exists pgcrypto;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ───────────────────────── Tables ─────────────────────────

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  house_type text not null default 'maison' check (house_type in ('maison', 'appartement', 'chalet')),
  invite_code text not null unique,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  stars int not null default 0 check (stars >= 0),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar text not null default 'panda',
  color text not null default 'lavande',
  mood text,
  mood_note text check (mood_note is null or char_length(mood_note) <= 80),
  mood_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  image_path text,
  body text check (body is null or char_length(body) <= 280),
  challenge text,
  created_at timestamptz not null default now(),
  check (image_path is not null or body is not null)
);
create index moments_family_idx on public.moments (family_id, created_at desc);

create table public.reactions (
  moment_id uuid not null references public.moments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  primary key (moment_id, member_id)
);
create index reactions_family_idx on public.reactions (family_id);

-- « On pense à toi » et petits mots
create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  from_member uuid not null references public.members (id) on delete cascade,
  to_member uuid not null references public.members (id) on delete cascade,
  kind text not null default 'coeur' check (kind in ('coeur', 'calin', 'courage', 'bisou', 'mot')),
  message text check (message is null or char_length(message) <= 140),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index thoughts_to_idx on public.thoughts (to_member, created_at desc);
create index thoughts_family_idx on public.thoughts (family_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  kind text not null default 'evenement' check (kind in ('anniversaire', 'rdv', 'evenement')),
  starts_at timestamptz not null,
  all_day boolean not null default false,
  yearly boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_family_idx on public.events (family_id, starts_at);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('course', 'tache')),
  title text not null check (char_length(title) between 1 and 80),
  done boolean not null default false,
  done_by uuid references public.members (id) on delete set null,
  assigned_to uuid references public.members (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index list_items_family_idx on public.list_items (family_id, created_at);

create table public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  day date not null default current_date,
  question_key text not null,
  answer text not null check (char_length(answer) between 1 and 140),
  created_at timestamptz not null default now(),
  unique (family_id, member_id, day)
);

create table public.star_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  reason text not null,
  amount int not null,
  created_at timestamptz not null default now()
);
create index star_log_family_idx on public.star_log (family_id, created_at desc);
create index star_log_member_idx on public.star_log (member_id, reason, created_at);

create table public.house_catalog (
  key text primary key,
  cost int not null check (cost >= 0)
);

create table public.house_items (
  family_id uuid not null references public.families (id) on delete cascade,
  item_key text not null references public.house_catalog (key),
  unlocked_by uuid references public.members (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  primary key (family_id, item_key)
);

insert into public.house_catalog (key, cost) values
  ('fleurs', 5), ('boite', 8), ('lanterne', 12), ('arbre', 18), ('fumee', 20),
  ('guirlande', 25), ('chat', 30), ('balancoire', 40), ('potager', 50), ('cabane', 70),
  ('fontaine', 90), ('montgolfiere', 120);

-- ───────────────────────── Fonctions internes ─────────────────────────

create function private.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.family_id = fid and m.user_id = (select auth.uid()));
$$;

create function private.my_member(fid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.members m where m.family_id = fid and m.user_id = (select auth.uid());
$$;

-- Ajoute des étoiles à la maison (avec plafond quotidien optionnel par membre et par raison)
create function private.award(p_family uuid, p_member uuid, p_reason text, p_amount int, p_daily_cap int default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_daily_cap is not null and (
    select count(*) from public.star_log s
    where s.member_id = p_member and s.reason = p_reason and s.created_at >= date_trunc('day', now())
  ) >= p_daily_cap then
    return;
  end if;
  insert into public.star_log (family_id, member_id, reason, amount) values (p_family, p_member, p_reason, p_amount);
  update public.families set stars = stars + p_amount where id = p_family;
end;
$$;

create function private.gen_invite_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      into code from generate_series(1, 6);
    exit when not exists (select 1 from public.families f where f.invite_code = code);
  end loop;
  return code;
end;
$$;

-- ───────────────────────── Triggers étoiles ─────────────────────────

create function private.on_moment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award(new.family_id, new.member_id, 'moment', 3, 5);
  return new;
end; $$;
create trigger moments_stars after insert on public.moments for each row execute function private.on_moment();

create function private.on_thought() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award(new.family_id, new.from_member, 'attention', 1, 5);
  return new;
end; $$;
create trigger thoughts_stars after insert on public.thoughts for each row execute function private.on_thought();

create function private.on_mood() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mood is distinct from old.mood or new.mood_note is distinct from old.mood_note then
    new.mood_at := now();
    if new.mood is not null then
      perform private.award(new.family_id, new.id, 'humeur', 1, 1);
    end if;
  else
    new.mood_at := old.mood_at;
  end if;
  return new;
end; $$;
create trigger members_mood before update on public.members for each row execute function private.on_mood();

create function private.on_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.award(new.family_id, new.member_id, 'question', 2, 1);
  return new;
end; $$;
create trigger answers_stars after insert on public.daily_answers for each row execute function private.on_answer();

create function private.on_item_done() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.done and not old.done and new.kind = 'tache' and new.done_by is not null then
    perform private.award(new.family_id, new.done_by, 'mission', 1, 8);
  end if;
  return new;
end; $$;
create trigger list_items_stars after update on public.list_items for each row execute function private.on_item_done();

-- ───────────────────────── RPC ─────────────────────────

create function public.create_family(p_name text, p_house_type text, p_display_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then raise exception 'NON_CONNECTE'; end if;
  -- Gratuit : une seule maison créée. Famille+ : plusieurs maisons.
  if exists (select 1 from public.families f where f.created_by = uid)
     and not exists (select 1 from public.families f where f.created_by = uid and f.plan = 'plus') then
    raise exception 'LIMITE_MAISONS';
  end if;
  insert into public.families (name, house_type, invite_code, created_by)
    values (trim(p_name), coalesce(p_house_type, 'maison'), private.gen_invite_code(), uid)
    returning id into fid;
  insert into public.members (family_id, user_id, display_name, avatar, color)
    values (fid, uid, trim(p_display_name), coalesce(p_avatar, 'panda'), coalesce(p_color, 'lavande'));
  return fid;
end;
$$;

create function public.preview_family(p_code text)
returns table (name text, house_type text, member_count int)
language sql stable security definer set search_path = '' as $$
  select f.name, f.house_type, (select count(*)::int from public.members m where m.family_id = f.id)
  from public.families f where f.invite_code = upper(trim(p_code));
$$;

create function public.join_family(p_code text, p_display_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fam public.families%rowtype;
  n int;
begin
  if uid is null then raise exception 'NON_CONNECTE'; end if;
  select * into fam from public.families f where f.invite_code = upper(trim(p_code));
  if not found then raise exception 'CODE_INCONNU'; end if;
  if exists (select 1 from public.members m where m.family_id = fam.id and m.user_id = uid) then
    return fam.id;
  end if;
  select count(*) into n from public.members m where m.family_id = fam.id;
  if n >= (case when fam.plan = 'plus' then 15 else 5 end) then
    raise exception 'FAMILLE_PLEINE';
  end if;
  insert into public.members (family_id, user_id, display_name, avatar, color)
    values (fam.id, uid, trim(p_display_name), coalesce(p_avatar, 'panda'), coalesce(p_color, 'lavande'));
  return fam.id;
end;
$$;

create function public.unlock_item(p_family uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  price int;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  select c.cost into price from public.house_catalog c where c.key = p_key;
  if price is null then raise exception 'OBJET_INCONNU'; end if;
  if exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = p_key) then
    return;
  end if;
  update public.families set stars = stars - price where id = p_family and stars >= price;
  if not found then raise exception 'PAS_ASSEZ_ETOILES'; end if;
  insert into public.house_items (family_id, item_key, unlocked_by) values (p_family, p_key, mid);
  insert into public.star_log (family_id, member_id, reason, amount) values (p_family, mid, 'deco:' || p_key, -price);
end;
$$;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.create_family(text, text, text, text, text) to authenticated;
grant execute on function public.preview_family(text) to authenticated;
grant execute on function public.join_family(text, text, text, text) to authenticated;
grant execute on function public.unlock_item(uuid, text) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.my_member(uuid) to authenticated;

-- ───────────────────────── Droits et RLS ─────────────────────────

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.moments enable row level security;
alter table public.reactions enable row level security;
alter table public.thoughts enable row level security;
alter table public.events enable row level security;
alter table public.list_items enable row level security;
alter table public.daily_answers enable row level security;
alter table public.star_log enable row level security;
alter table public.house_catalog enable row level security;
alter table public.house_items enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.families to authenticated;
grant update (name, house_type) on public.families to authenticated;
grant select, delete on public.members to authenticated;
grant update (display_name, avatar, color, mood, mood_note) on public.members to authenticated;
grant select, insert, delete on public.moments to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;
grant select, insert on public.thoughts to authenticated;
grant update (seen_at) on public.thoughts to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.list_items to authenticated;
grant select, insert on public.daily_answers to authenticated;
grant select on public.star_log to authenticated;
grant select on public.house_catalog to authenticated;
grant select on public.house_items to authenticated;

create policy families_select on public.families for select to authenticated
  using (private.is_member(id));
create policy families_update on public.families for update to authenticated
  using (private.is_member(id)) with check (private.is_member(id));

create policy members_select on public.members for select to authenticated
  using (private.is_member(family_id));
create policy members_update on public.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy members_delete on public.members for delete to authenticated
  using (user_id = (select auth.uid()));

create policy moments_select on public.moments for select to authenticated
  using (private.is_member(family_id));
create policy moments_insert on public.moments for insert to authenticated
  with check (member_id = private.my_member(family_id));
create policy moments_delete on public.moments for delete to authenticated
  using (member_id = private.my_member(family_id));

create policy reactions_select on public.reactions for select to authenticated
  using (private.is_member(family_id));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (member_id = private.my_member(family_id)
    and exists (select 1 from public.moments mo where mo.id = moment_id and mo.family_id = reactions.family_id));
create policy reactions_update on public.reactions for update to authenticated
  using (member_id = private.my_member(family_id)) with check (member_id = private.my_member(family_id));
create policy reactions_delete on public.reactions for delete to authenticated
  using (member_id = private.my_member(family_id));

create policy thoughts_select on public.thoughts for select to authenticated
  using (private.my_member(family_id) in (from_member, to_member));
create policy thoughts_insert on public.thoughts for insert to authenticated
  with check (from_member = private.my_member(family_id)
    and exists (select 1 from public.members m where m.id = to_member and m.family_id = thoughts.family_id));
create policy thoughts_update on public.thoughts for update to authenticated
  using (to_member = private.my_member(family_id)) with check (to_member = private.my_member(family_id));

create policy events_all on public.events for all to authenticated
  using (private.is_member(family_id)) with check (private.is_member(family_id));

create policy list_items_all on public.list_items for all to authenticated
  using (private.is_member(family_id)) with check (private.is_member(family_id));

create policy answers_select on public.daily_answers for select to authenticated
  using (private.is_member(family_id));
create policy answers_insert on public.daily_answers for insert to authenticated
  with check (member_id = private.my_member(family_id));

create policy star_log_select on public.star_log for select to authenticated
  using (private.is_member(family_id));

create policy catalog_select on public.house_catalog for select to authenticated using (true);

create policy house_items_select on public.house_items for select to authenticated
  using (private.is_member(family_id));

-- ───────────────────────── Photos (bucket privé) ─────────────────────────
-- Chemin : <family_id>/<uuid>.jpg — lisible uniquement par les membres de la famille.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moments', 'moments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy moments_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'moments' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy moments_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moments' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy moments_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moments' and owner_id = (select auth.uid())::text);

-- ───────────────────────── Temps réel ─────────────────────────

alter publication supabase_realtime add table
  public.families, public.members, public.moments, public.reactions, public.thoughts,
  public.events, public.list_items, public.daily_answers, public.house_items;
