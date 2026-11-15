-- 0011 : les croquettes de la maison, les caresses, et les animaux qui s'en vont si on les oublie.

-- ───────────────────────── Croquettes ─────────────────────────
-- Un stock commun : le chat et les oiseaux mangent la même chose. Chaque repas en
-- consomme un ; un sac de 10 repas s'achète 15 étoiles.

alter table public.families add column food int not null default 0 check (food between 0 and 100);

create function public.buy_food(p_family uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  left_now int;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if (select f.food from public.families f where f.id = p_family) > 90 then raise exception 'STOCK_PLEIN'; end if;
  update public.families set stars = stars - 15, food = food + 10
    where id = p_family and stars >= 15
    returning food into left_now;
  if not found then raise exception 'PAS_ASSEZ_ETOILES'; end if;
  insert into public.star_log (family_id, member_id, reason, amount) values (p_family, mid, 'croquettes', -15);
  return left_now;
end;
$$;

-- Nourrir un animal consomme un repas ; les plantes s'arrosent sans rien dépenser.
create or replace function public.care_item(p_family uuid, p_key text) returns int
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
  if p_key in ('chat', 'cabane') then
    -- si le stock est vide, l'exception annule aussi le repas noté juste au-dessus
    update public.families set food = food - 1 where id = p_family and food > 0;
    if not found then raise exception 'PLUS_DE_CROQUETTES'; end if;
  end if;
  perform private.award(p_family, mid, 'soin:' || p_key, amount);
  return amount;
end;
$$;

-- ───────────────────────── Caresses ─────────────────────────
-- On peut caresser autant qu'on veut ; la première caresse du jour rapporte 1 étoile, à chacun.

create function public.pet_animal(p_family uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  since timestamptz := ((now() at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris';
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if p_key not in ('chat', 'cabane') then raise exception 'PAS_DE_SOIN'; end if;
  if not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = p_key) then
    raise exception 'PAS_INSTALLE';
  end if;
  if exists (select 1 from public.star_log s where s.member_id = mid and s.reason = 'caresse' and s.created_at >= since) then
    return 0;
  end if;
  perform private.award(p_family, mid, 'caresse', 1);
  return 1;
end;
$$;

-- ───────────────────────── Les oubliés ─────────────────────────
-- Un animal qui n'a pas mangé depuis la veille est triste, depuis deux jours il déprime ;
-- au quatrième jour sans repas (trois jours entiers oubliés), il s'en va : il est retiré
-- du jardin, sans rendre les étoiles. Le départ est noté pour que la famille le sache.

create function public.check_garden(p_family uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  gone text[] := '{}';
  r record;
begin
  if private.my_member(p_family) is null then raise exception 'PAS_MEMBRE'; end if;
  for r in
    select h.item_key,
      coalesce(
        (select max(c.day) from public.house_care c where c.family_id = p_family and c.item_key = h.item_key),
        (h.unlocked_at at time zone 'Europe/Paris')::date
      ) as base
    from public.house_items h
    where h.family_id = p_family and h.item_key in ('chat', 'cabane')
  loop
    if today - r.base >= 4 then
      delete from public.house_items where family_id = p_family and item_key = r.item_key;
      insert into public.star_log (family_id, member_id, reason, amount) values (p_family, null, 'parti:' || r.item_key, 0);
      gone := gone || r.item_key;
    end if;
  end loop;
  return gone;
end;
$$;

revoke execute on function public.buy_food(uuid), public.care_item(uuid, text), public.pet_animal(uuid, text), public.check_garden(uuid) from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function public.buy_food(uuid) to authenticated;
grant execute on function public.care_item(uuid, text) to authenticated;
grant execute on function public.pet_animal(uuid, text) to authenticated;
grant execute on function public.check_garden(uuid) to authenticated;
