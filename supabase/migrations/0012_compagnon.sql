-- 0012 : le compagnon de la famille, le potager qu'on sème, et le centre commercial.
--
-- Le compagnon (un seul par famille) se choisit parmi huit animaux et grandit avec l'amour
-- de la famille : chaque repas, caresse, friandise et partie de jeu le fait grandir
-- (bébé, puis jeune, puis adulte). Le potager a trois parcelles : on y sème des graines
-- achetées à la supérette, chaque arrosage les fait pousser, et la récolte rapporte des étoiles.
-- Le centre commercial vend les consommables (friandises, graines, engrais) et les objets
-- qu'on garde (coin et jeux du compagnon, ses vêtements, les accessoires de la famille).

-- ───────────────────────── Le catalogue (les prix font foi côté serveur) ─────────────────────────

create table private.shop_catalog (
  key text primary key,
  cost int not null check (cost > 0),
  qty int check (qty is null or qty > 0) -- null : un objet qu'on garde ; sinon, combien on en reçoit
);
insert into private.shop_catalog (key, cost, qty) values
  ('friandises', 8, 5), ('engrais', 6, 1),
  ('graines:carotte', 4, 1), ('graines:salade', 4, 1), ('graines:tournesol', 5, 1),
  ('graines:tomate', 6, 1), ('graines:fraise', 8, 1), ('graines:citrouille', 10, 1),
  ('lit:coussin', 15, null), ('lit:panier', 20, null), ('lit:arbre', 35, null), ('lit:niche', 40, null),
  ('jeu:balle', 10, null), ('jeu:pelote', 10, null), ('jeu:souris', 10, null), ('jeu:os', 12, null), ('jeu:plumeau', 12, null),
  ('habit:noeud', 12, null), ('habit:bandana', 12, null), ('habit:bonnet', 15, null), ('habit:pull', 20, null),
  ('gamelle:or', 25, null),
  ('mode:noeud', 8, null), ('mode:bonnet', 10, null), ('mode:casquette', 10, null), ('mode:echarpe', 10, null),
  ('mode:paille', 12, null), ('mode:lunettes', 12, null), ('mode:fleurs', 15, null), ('mode:couronne', 30, null);

create table public.family_stock (
  family_id uuid not null references public.families (id) on delete cascade,
  item_key text not null,
  qty int not null check (qty between 0 and 99),
  primary key (family_id, item_key)
);
create table public.shop_items (
  family_id uuid not null references public.families (id) on delete cascade,
  item_key text not null,
  bought_by uuid references public.members (id) on delete set null,
  bought_at timestamptz not null default now(),
  primary key (family_id, item_key)
);

create function public.buy_item(p_family uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  c record;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  select * into c from private.shop_catalog s where s.key = p_key;
  if not found then raise exception 'OBJET_INCONNU'; end if;
  if c.qty is null and exists (select 1 from public.shop_items i where i.family_id = p_family and i.item_key = p_key) then
    raise exception 'DEJA_ACHETE';
  end if;
  if c.qty is not null and coalesce((select s.qty from public.family_stock s where s.family_id = p_family and s.item_key = p_key), 0) + c.qty > 99 then
    raise exception 'STOCK_PLEIN';
  end if;
  update public.families set stars = stars - c.cost where id = p_family and stars >= c.cost;
  if not found then raise exception 'PAS_ASSEZ_ETOILES'; end if;
  if c.qty is null then
    insert into public.shop_items (family_id, item_key, bought_by) values (p_family, p_key, mid);
  else
    insert into public.family_stock (family_id, item_key, qty) values (p_family, p_key, c.qty)
    on conflict (family_id, item_key) do update set qty = public.family_stock.qty + excluded.qty;
  end if;
  insert into public.star_log (family_id, member_id, reason, amount) values (p_family, mid, 'achat:' || p_key, -c.cost);
  return (select f.stars from public.families f where f.id = p_family);
end;
$$;

/** Prend un objet du placard ; faux s'il n'y en a plus. */
create function private.take(p_family uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.family_stock set qty = qty - 1 where family_id = p_family and item_key = p_key and qty > 0;
  return found;
end;
$$;

-- ───────────────────────── Le compagnon ─────────────────────────

create table public.pets (
  family_id uuid primary key references public.families (id) on delete cascade,
  species text not null check (species in ('chat', 'chien', 'lapin', 'renard', 'panda', 'koala', 'pingouin', 'hibou')),
  name text not null check (char_length(name) between 1 and 24),
  love int not null default 0 check (love between 0 and 1000000),
  outfit text check (outfit is null or outfit like 'habit:%'),
  bed text check (bed is null or bed like 'lit:%'),
  adopted_by uuid references public.members (id) on delete set null,
  adopted_at timestamptz not null default now()
);

-- Le chat du jardin devient le compagnon : les soins s'appellent maintenant « compagnon ».
alter table public.house_care drop constraint house_care_item_key_check;
update public.house_care set item_key = 'compagnon' where item_key = 'chat';
alter table public.house_care add constraint house_care_item_key_check check (item_key in ('compagnon', 'cabane', 'fleurs', 'potager'));
insert into public.pets (family_id, species, name, adopted_by, adopted_at)
  select family_id, 'chat', 'Minou', unlocked_by, unlocked_at from public.house_items where item_key = 'chat'
  on conflict do nothing;
delete from public.house_items where item_key = 'chat';
delete from public.house_catalog where key = 'chat';

create function public.adopt_pet(p_family uuid, p_species text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'DEJA_UN_COMPAGNON'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'PRENOM_VIDE'; end if;
  update public.families set stars = stars - 30 where id = p_family and stars >= 30;
  if not found then raise exception 'PAS_ASSEZ_ETOILES'; end if;
  insert into public.pets (family_id, species, name, adopted_by) values (p_family, p_species, left(trim(p_name), 24), mid);
  insert into public.star_log (family_id, member_id, reason, amount) values (p_family, mid, 'adoption', -30);
end;
$$;

/** Sa tenue, son coin, son prénom : seulement avec ce que la famille a acheté. */
create function public.dress_pet(p_family uuid, p_outfit text, p_bed text, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if not exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'PAS_DE_COMPAGNON'; end if;
  if nullif(p_outfit, '') is not null and not exists (select 1 from public.shop_items i where i.family_id = p_family and i.item_key = p_outfit and i.item_key like 'habit:%') then
    raise exception 'PAS_ACHETE';
  end if;
  if nullif(p_bed, '') is not null and not exists (select 1 from public.shop_items i where i.family_id = p_family and i.item_key = p_bed and i.item_key like 'lit:%') then
    raise exception 'PAS_ACHETE';
  end if;
  update public.pets set
    outfit = nullif(p_outfit, ''),
    bed = nullif(p_bed, ''),
    name = coalesce(left(nullif(trim(p_name), ''), 24), name)
  where family_id = p_family;
end;
$$;

/** Une friandise : +3 d'amour. */
create function public.give_treat(p_family uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  l int;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if not exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'PAS_DE_COMPAGNON'; end if;
  if not private.take(p_family, 'friandises') then raise exception 'PLUS_DE_FRIANDISES'; end if;
  update public.pets set love = love + 3 where family_id = p_family returning love into l;
  return l;
end;
$$;

/** Jouer avec un de ses jouets : la première partie du jour de chacun donne +2 d'amour et 1 étoile. */
create function public.play_pet(p_family uuid, p_toy text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  since timestamptz := ((now() at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris';
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if not exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'PAS_DE_COMPAGNON'; end if;
  if p_toy not like 'jeu:%' or not exists (select 1 from public.shop_items i where i.family_id = p_family and i.item_key = p_toy) then
    raise exception 'PAS_ACHETE';
  end if;
  if exists (select 1 from public.star_log s where s.member_id = mid and s.reason = 'jeu' and s.created_at >= since) then
    return 0;
  end if;
  update public.pets set love = love + 2 where family_id = p_family;
  perform private.award(p_family, mid, 'jeu', 1);
  return 1;
end;
$$;

-- ───────────────────────── Le potager ─────────────────────────

create table public.garden_plots (
  family_id uuid not null references public.families (id) on delete cascade,
  plot int not null check (plot between 0 and 2),
  plant text not null check (plant in ('carotte', 'salade', 'tournesol', 'tomate', 'fraise', 'citrouille')),
  growth int not null default 0 check (growth between 0 and 30),
  planted_by uuid references public.members (id) on delete set null,
  planted_at timestamptz not null default now(),
  primary key (family_id, plot)
);

/** Combien d'arrosages avant la récolte, et combien elle rapporte. */
create function private.plant_info(p_plant text, out ripe int, out reward int)
language sql immutable as $$
  select r.ripe, r.reward from (values
    ('carotte', 4, 8), ('salade', 4, 8), ('tournesol', 5, 10),
    ('tomate', 6, 13), ('fraise', 7, 17), ('citrouille', 9, 22)
  ) as r(plant, ripe, reward) where r.plant = p_plant
$$;

create function public.plant_seed(p_family uuid, p_plot int, p_plant text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = 'potager') then raise exception 'PAS_DE_POTAGER'; end if;
  if p_plot not between 0 and 2 then raise exception 'PARCELLE_INCONNUE'; end if;
  if exists (select 1 from public.garden_plots g where g.family_id = p_family and g.plot = p_plot) then raise exception 'PARCELLE_PRISE'; end if;
  if (select ripe from private.plant_info(p_plant)) is null then raise exception 'PLANTE_INCONNUE'; end if;
  if not private.take(p_family, 'graines:' || p_plant) then raise exception 'PLUS_DE_GRAINES'; end if;
  insert into public.garden_plots (family_id, plot, plant, planted_by) values (p_family, p_plot, p_plant, mid);
end;
$$;

/** L'engrais fait pousser tout le potager d'un cran. */
create function public.fertilize(p_family uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.my_member(p_family) is null then raise exception 'PAS_MEMBRE'; end if;
  if not exists (select 1 from public.garden_plots g where g.family_id = p_family) then raise exception 'RIEN_A_FAIRE_POUSSER'; end if;
  if not private.take(p_family, 'engrais') then raise exception 'PLUS_D_ENGRAIS'; end if;
  update public.garden_plots set growth = least(30, growth + 1) where family_id = p_family;
end;
$$;

create function public.harvest(p_family uuid, p_plot int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  g record;
  info record;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  select * into g from public.garden_plots p where p.family_id = p_family and p.plot = p_plot;
  if not found then raise exception 'PARCELLE_VIDE'; end if;
  select * into info from private.plant_info(g.plant);
  if g.growth < info.ripe then raise exception 'PAS_ENCORE_MUR'; end if;
  delete from public.garden_plots where family_id = p_family and plot = p_plot;
  perform private.award(p_family, mid, 'recolte:' || g.plant, info.reward);
  return info.reward;
end;
$$;

-- ───────────────────────── Les soins, avec le compagnon et le potager ─────────────────────────

-- Nourrir le compagnon : +3 étoiles, +2 d'amour. Arroser le potager fait pousser ce qui y est planté.
create or replace function public.care_item(p_family uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  amount int := case p_key when 'compagnon' then 3 when 'cabane' then 3 when 'fleurs' then 1 when 'potager' then 1 end;
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if amount is null then raise exception 'PAS_DE_SOIN'; end if;
  if p_key = 'compagnon' then
    if not exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'PAS_DE_COMPAGNON'; end if;
  elsif not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = p_key) then
    raise exception 'PAS_INSTALLE';
  end if;
  insert into public.house_care (family_id, item_key, day, member_id) values (p_family, p_key, today, mid)
  on conflict do nothing;
  if not found then raise exception 'DEJA_FAIT'; end if;
  if p_key in ('compagnon', 'cabane') then
    update public.families set food = food - 1 where id = p_family and food > 0;
    if not found then raise exception 'PLUS_DE_CROQUETTES'; end if;
  end if;
  if p_key = 'compagnon' then
    update public.pets set love = love + 2 where family_id = p_family;
  elsif p_key = 'potager' then
    update public.garden_plots set growth = least(30, growth + 1) where family_id = p_family;
  end if;
  perform private.award(p_family, mid, 'soin:' || p_key, amount);
  return amount;
end;
$$;

-- Caresser : la première caresse du jour de chacun donne 1 étoile (et +1 d'amour au compagnon).
create or replace function public.pet_animal(p_family uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid := private.my_member(p_family);
  since timestamptz := ((now() at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris';
begin
  if mid is null then raise exception 'PAS_MEMBRE'; end if;
  if p_key = 'compagnon' then
    if not exists (select 1 from public.pets p where p.family_id = p_family) then raise exception 'PAS_DE_COMPAGNON'; end if;
  elsif p_key = 'cabane' then
    if not exists (select 1 from public.house_items h where h.family_id = p_family and h.item_key = 'cabane') then raise exception 'PAS_INSTALLE'; end if;
  else
    raise exception 'PAS_DE_SOIN';
  end if;
  if exists (select 1 from public.star_log s where s.member_id = mid and s.reason = 'caresse' and s.created_at >= since) then
    return 0;
  end if;
  if p_key = 'compagnon' then
    update public.pets set love = love + 1 where family_id = p_family;
  end if;
  perform private.award(p_family, mid, 'caresse', 1);
  return 1;
end;
$$;

-- Les oubliés : le compagnon qui n'a pas mangé depuis 4 jours s'en va (son amour avec lui).
create or replace function public.check_garden(p_family uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  gone text[] := '{}';
  base date;
  p record;
begin
  if private.my_member(p_family) is null then raise exception 'PAS_MEMBRE'; end if;
  select * into p from public.pets where family_id = p_family;
  if found then
    base := coalesce(
      (select max(c.day) from public.house_care c where c.family_id = p_family and c.item_key = 'compagnon'),
      (p.adopted_at at time zone 'Europe/Paris')::date
    );
    if today - base >= 4 then
      delete from public.pets where family_id = p_family;
      insert into public.star_log (family_id, member_id, reason, amount)
        values (p_family, null, 'parti:compagnon:' || p.species || ':' || p.name, 0);
      gone := gone || 'compagnon'::text;
    end if;
  end if;
  select coalesce(
    (select max(c.day) from public.house_care c where c.family_id = p_family and c.item_key = 'cabane'),
    (select (h.unlocked_at at time zone 'Europe/Paris')::date from public.house_items h where h.family_id = p_family and h.item_key = 'cabane')
  ) into base;
  if base is not null and today - base >= 4 then
    delete from public.house_items where family_id = p_family and item_key = 'cabane';
    insert into public.star_log (family_id, member_id, reason, amount) values (p_family, null, 'parti:cabane', 0);
    gone := gone || 'cabane'::text;
  end if;
  return gone;
end;
$$;

-- ───────────────────────── Droits ─────────────────────────

alter table public.pets enable row level security;
alter table public.garden_plots enable row level security;
alter table public.family_stock enable row level security;
alter table public.shop_items enable row level security;
grant select on public.pets, public.garden_plots, public.family_stock, public.shop_items to authenticated;
create policy pets_select on public.pets for select to authenticated using (private.is_member(family_id));
create policy garden_plots_select on public.garden_plots for select to authenticated using (private.is_member(family_id));
create policy family_stock_select on public.family_stock for select to authenticated using (private.is_member(family_id));
create policy shop_items_select on public.shop_items for select to authenticated using (private.is_member(family_id));

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on function
  public.buy_item(uuid, text), public.adopt_pet(uuid, text, text), public.dress_pet(uuid, text, text, text),
  public.give_treat(uuid), public.play_pet(uuid, text), public.plant_seed(uuid, int, text), public.fertilize(uuid),
  public.harvest(uuid, int), public.care_item(uuid, text), public.pet_animal(uuid, text), public.check_garden(uuid)
to authenticated;

alter publication supabase_realtime add table public.pets, public.garden_plots, public.family_stock, public.shop_items;
