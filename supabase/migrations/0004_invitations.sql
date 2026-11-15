-- NIDOO — Entrer dans une famille sur acceptation
-- Le code d'invitation ne fait plus entrer : il permet seulement de DEMANDER à entrer.
-- Un responsable de la famille accepte ou refuse chaque demande ; avant d'être accepté, on ne voit rien.
-- Le code expire au bout de 7 jours, un responsable peut le changer à tout moment,
-- et les essais de code sont limités pour qu'on ne puisse pas les deviner.

-- ───────────────────────── Responsables ─────────────────────────

alter table public.members add column role text not null default 'membre' check (role in ('responsable', 'membre'));

-- Le créateur de chaque famille devient responsable ; à défaut, le membre le plus ancien.
update public.members m set role = 'responsable'
  from public.families f where f.id = m.family_id and f.created_by = m.user_id;
update public.members m set role = 'responsable'
  where m.id in (
    select distinct on (x.family_id) x.id from public.members x
    where not exists (select 1 from public.members y where y.family_id = x.family_id and y.role = 'responsable')
    order by x.family_id, x.joined_at
  );

alter table public.families add column invite_expires_at timestamptz not null default now() + interval '7 days';

create function private.is_admin(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.family_id = fid and m.user_id = (select auth.uid()) and m.role = 'responsable');
$$;
grant execute on function private.is_admin(uuid) to authenticated;

-- Une famille garde toujours au moins un responsable : si le dernier part, le plus ancien prend le relais.
create function private.keep_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.families f where f.id = old.family_id)
     and not exists (select 1 from public.members m where m.family_id = old.family_id and m.role = 'responsable') then
    update public.members set role = 'responsable'
      where id = (select m.id from public.members m where m.family_id = old.family_id order by m.joined_at limit 1);
  end if;
  return null;
end; $$;
create trigger members_keep_admin after delete on public.members for each row execute function private.keep_admin();

-- ───────────────────────── Demandes d'entrée ─────────────────────────

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar text not null default 'panda',
  color text not null default 'lavande',
  status text not null default 'attente' check (status in ('attente', 'refusee')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index join_requests_user_idx on public.join_requests (user_id);

alter table public.join_requests enable row level security;
grant select, delete on public.join_requests to authenticated;
-- La personne voit sa demande ; les responsables voient celles de leur famille. Personne n'écrit directement.
create policy join_requests_select on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin(family_id));
create policy join_requests_delete on public.join_requests for delete to authenticated
  using (user_id = (select auth.uid()));

-- Essais de code : 15 par heure et par compte au maximum.
create table private.code_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index code_attempts_idx on private.code_attempts (user_id, at);
revoke all on private.code_attempts from public, anon, authenticated;

create function private.count_attempt() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  delete from private.code_attempts where user_id = uid and at < now() - interval '1 day';
  if (select count(*) from private.code_attempts where user_id = uid and at > now() - interval '1 hour') >= 15 then
    raise exception 'TROP_D_ESSAIS';
  end if;
  insert into private.code_attempts (user_id) values (uid);
end; $$;

-- ───────────────────────── RPC ─────────────────────────

-- Le créateur devient responsable.
create or replace function public.create_family(p_name text, p_house_type text, p_display_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then raise exception 'NON_CONNECTE'; end if;
  if exists (select 1 from public.families f where f.created_by = uid)
     and not exists (select 1 from public.families f where f.created_by = uid and f.plan = 'plus') then
    raise exception 'LIMITE_MAISONS';
  end if;
  insert into public.families (name, house_type, invite_code, created_by)
    values (trim(p_name), coalesce(p_house_type, 'maison'), private.gen_invite_code(), uid)
    returning id into fid;
  insert into public.members (family_id, user_id, display_name, avatar, color, role)
    values (fid, uid, trim(p_display_name), coalesce(p_avatar, 'panda'), coalesce(p_color, 'lavande'), 'responsable');
  return fid;
end;
$$;

-- Aperçu avant de demander : seulement le nom et le nombre de membres. Compte comme un essai.
create or replace function public.preview_family(p_code text)
returns table (name text, house_type text, member_count int)
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam public.families%rowtype;
begin
  if auth.uid() is null then raise exception 'NON_CONNECTE'; end if;
  perform private.count_attempt();
  select * into fam from public.families f where f.invite_code = upper(trim(p_code));
  if not found then return; end if;
  if fam.invite_expires_at < now() then raise exception 'CODE_EXPIRE'; end if;
  return query select fam.name, fam.house_type, (select count(*)::int from public.members m where m.family_id = fam.id);
end;
$$;

-- Le code ne fait plus entrer : il crée une demande, que la famille accepte ou non.
-- Renvoie l'identifiant de la famille, ou null si le code n'existe pas.
create or replace function public.join_family(p_code text, p_display_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fam public.families%rowtype;
begin
  if uid is null then raise exception 'NON_CONNECTE'; end if;
  perform private.count_attempt();
  select * into fam from public.families f where f.invite_code = upper(trim(p_code));
  -- Code inconnu : on renvoie vide plutôt qu'une erreur, pour que l'essai reste compté.
  if not found then return null; end if;
  if fam.invite_expires_at < now() then raise exception 'CODE_EXPIRE'; end if;
  if exists (select 1 from public.members m where m.family_id = fam.id and m.user_id = uid) then
    return fam.id;
  end if;
  if (select count(*) from public.members m where m.family_id = fam.id) >= (case when fam.plan = 'plus' then 15 else 5 end) then
    raise exception 'FAMILLE_PLEINE';
  end if;
  if (select count(*) from public.join_requests r where r.user_id = uid and r.family_id <> fam.id) >= 3
     or (select count(*) from public.join_requests r where r.family_id = fam.id and r.user_id <> uid and r.status = 'attente') >= 20 then
    raise exception 'TROP_DE_DEMANDES';
  end if;
  insert into public.join_requests (family_id, user_id, display_name, avatar, color)
    values (fam.id, uid, trim(p_display_name), coalesce(p_avatar, 'panda'), coalesce(p_color, 'lavande'))
    on conflict (family_id, user_id) do update
      set display_name = excluded.display_name, avatar = excluded.avatar, color = excluded.color,
          status = 'attente', created_at = now();
  return fam.id;
end;
$$;

-- Mes demandes en cours (la famille n'est pas encore lisible : on n'en montre que le nom).
create function public.my_requests()
returns table (id uuid, family_id uuid, family_name text, house_type text, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.family_id, f.name, f.house_type, r.status, r.created_at
  from public.join_requests r join public.families f on f.id = r.family_id
  where r.user_id = (select auth.uid())
  order by r.created_at desc;
$$;

create function public.answer_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  req public.join_requests%rowtype;
  fam public.families%rowtype;
begin
  select * into req from public.join_requests r where r.id = p_request;
  if not found then raise exception 'DEMANDE_INCONNUE'; end if;
  if not private.is_admin(req.family_id) then raise exception 'PAS_RESPONSABLE'; end if;
  if not p_accept then
    update public.join_requests set status = 'refusee' where id = req.id;
    return;
  end if;
  select * into fam from public.families f where f.id = req.family_id;
  if (select count(*) from public.members m where m.family_id = fam.id) >= (case when fam.plan = 'plus' then 15 else 5 end) then
    raise exception 'FAMILLE_PLEINE';
  end if;
  insert into public.members (family_id, user_id, display_name, avatar, color)
    values (req.family_id, req.user_id, req.display_name, req.avatar, req.color)
    on conflict (family_id, user_id) do nothing;
  delete from public.join_requests where id = req.id;
end;
$$;

-- Nouveau code : l'ancien ne marche plus, le nouveau vaut 7 jours.
create function public.renew_invite(p_family uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text := private.gen_invite_code();
begin
  if not private.is_admin(p_family) then raise exception 'PAS_RESPONSABLE'; end if;
  update public.families set invite_code = code, invite_expires_at = now() + interval '7 days' where id = p_family;
  return code;
end;
$$;

create function public.set_member_role(p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members x where x.id = p_member;
  if not found then raise exception 'MEMBRE_INCONNU'; end if;
  if not private.is_admin(m.family_id) then raise exception 'PAS_RESPONSABLE'; end if;
  if p_role not in ('responsable', 'membre') then raise exception 'ROLE_INCONNU'; end if;
  if p_role = 'membre' and m.role = 'responsable'
     and (select count(*) from public.members x where x.family_id = m.family_id and x.role = 'responsable') <= 1 then
    raise exception 'DERNIER_RESPONSABLE';
  end if;
  update public.members set role = p_role where id = p_member;
end;
$$;

-- Retirer quelqu'un de la famille (pour soi-même, c'est « Quitter cette maison »).
create function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members x where x.id = p_member;
  if not found then raise exception 'MEMBRE_INCONNU'; end if;
  if not private.is_admin(m.family_id) then raise exception 'PAS_RESPONSABLE'; end if;
  if m.user_id = auth.uid() then raise exception 'UTILISE_QUITTER'; end if;
  delete from public.members where id = p_member;
end;
$$;

revoke execute on function public.my_requests(), public.answer_request(uuid, boolean), public.renew_invite(uuid),
  public.set_member_role(uuid, text), public.remove_member(uuid) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.my_requests() to authenticated;
grant execute on function public.answer_request(uuid, boolean) to authenticated;
grant execute on function public.renew_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

alter publication supabase_realtime add table public.join_requests;
