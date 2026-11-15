-- NIDOO — Enfants et bébés sans téléphone
-- Un bébé n'a pas de compte : un proche l'ajoute à la maison (profil sans téléphone).
-- Il a son personnage, vit dans le jardin, reçoit des câlins ; la famille donne son humeur du jour.
-- Ces profils ne comptent pas dans la limite de membres et ne peuvent pas être responsables.

alter table public.members alter column user_id drop not null;
alter table public.members add column managed_by uuid references public.members (id) on delete set null;

-- Tous les membres de la famille peuvent modifier un profil sans téléphone (personnage, humeur).
create policy members_update_profils on public.members for update to authenticated
  using (user_id is null and private.is_member(family_id))
  with check (user_id is null and private.is_member(family_id));

create function public.add_child(p_family uuid, p_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  new_id uuid;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if (select count(*) from public.members m where m.family_id = p_family and m.user_id is null) >= 10 then
    raise exception 'TROP_D_ENFANTS';
  end if;
  insert into public.members (family_id, user_id, display_name, avatar, color, managed_by, role)
    values (p_family, null, trim(p_name), coalesce(p_avatar, 'panda'), coalesce(p_color, 'lavande'), mid, 'membre')
    returning members.id into new_id;
  return new_id;
end;
$$;

-- Retirer : un responsable, ou la personne qui a ajouté ce profil sans téléphone.
create or replace function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members x where x.id = p_member;
  if not found then raise exception 'MEMBRE_INCONNU'; end if;
  if not (private.is_admin(m.family_id) or (m.user_id is null and m.managed_by = private.my_member(m.family_id))) then
    raise exception 'PAS_RESPONSABLE';
  end if;
  if m.user_id = auth.uid() then raise exception 'UTILISE_QUITTER'; end if;
  delete from public.members where id = p_member;
end;
$$;

create or replace function public.set_member_role(p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.members%rowtype;
begin
  select * into m from public.members x where x.id = p_member;
  if not found then raise exception 'MEMBRE_INCONNU'; end if;
  if not private.is_admin(m.family_id) then raise exception 'PAS_RESPONSABLE'; end if;
  if m.user_id is null then raise exception 'PROFIL_SANS_COMPTE'; end if;
  if p_role not in ('responsable', 'membre') then raise exception 'ROLE_INCONNU'; end if;
  if p_role = 'membre' and m.role = 'responsable'
     and (select count(*) from public.members x where x.family_id = m.family_id and x.role = 'responsable') <= 1 then
    raise exception 'DERNIER_RESPONSABLE';
  end if;
  update public.members set role = p_role where id = p_member;
end;
$$;

-- Le relais de responsable ne va qu'à quelqu'un qui a un compte.
create or replace function private.keep_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.families f where f.id = old.family_id)
     and not exists (select 1 from public.members m where m.family_id = old.family_id and m.role = 'responsable') then
    update public.members set role = 'responsable'
      where id = (select m.id from public.members m where m.family_id = old.family_id and m.user_id is not null order by m.joined_at limit 1);
  end if;
  return null;
end; $$;

-- La limite de membres ne compte que les comptes (les petits sans téléphone sont en plus).
create or replace function public.join_family(p_code text, p_display_name text, p_avatar text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fam public.families%rowtype;
begin
  if uid is null then raise exception 'NON_CONNECTE'; end if;
  perform private.count_attempt();
  select * into fam from public.families f where f.invite_code = upper(trim(p_code));
  if not found then return null; end if;
  if fam.invite_expires_at < now() then raise exception 'CODE_EXPIRE'; end if;
  if exists (select 1 from public.members m where m.family_id = fam.id and m.user_id = uid) then
    return fam.id;
  end if;
  if (select count(*) from public.members m where m.family_id = fam.id and m.user_id is not null) >= (case when fam.plan = 'plus' then 15 else 5 end) then
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

create or replace function public.answer_request(p_request uuid, p_accept boolean)
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
  if (select count(*) from public.members m where m.family_id = fam.id and m.user_id is not null) >= (case when fam.plan = 'plus' then 15 else 5 end) then
    raise exception 'FAMILLE_PLEINE';
  end if;
  insert into public.members (family_id, user_id, display_name, avatar, color)
    values (req.family_id, req.user_id, req.display_name, req.avatar, req.color)
    on conflict (family_id, user_id) do nothing;
  delete from public.join_requests where id = req.id;
end;
$$;

revoke execute on function public.add_child(uuid, text, text, text) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.add_child(uuid, text, text, text) to authenticated;
