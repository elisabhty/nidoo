-- « À deux, on porte ! » : les records de chacun, gardés sur le compte (plus seulement sur le téléphone),
-- et les étoiles pour la maison.
-- La partie se joue sur le téléphone ; la base ne peut pas la rejouer. Elle se contente donc de ce qui ne peut pas
-- s'emballer : une étoile pour la maison par étoile de niveau gagnée pour la première fois (8 niveaux × 3 étoiles,
-- soit 24 au plus par personne), et un niveau ne compte que si le précédent a été fini.

create table public.porte_records (
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  niveau smallint not null check (niveau between 0 and 7),
  etoiles smallint not null check (etoiles between 1 and 3),
  temps numeric(6, 1) not null check (temps > 0),
  updated_at timestamptz not null default now(),
  primary key (member_id, niveau)
);
create index porte_records_family_idx on public.porte_records (family_id);
alter table public.porte_records enable row level security;
grant select on public.porte_records to authenticated;
create policy porte_records_select on public.porte_records for select to authenticated using (private.is_member(family_id));

/** Une partie gagnée : garde le meilleur résultat du niveau, et donne à la maison les étoiles gagnées pour la première fois. */
create function public.porte_fini(p_family uuid, p_niveau int, p_etoiles int, p_temps numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.my_member(p_family);
  avant public.porte_records%rowtype;
  v_gain int;
begin
  if me is null then raise exception 'PAS_MEMBRE'; end if;
  if p_niveau is null or p_niveau < 0 or p_niveau > 7 then raise exception 'NIVEAU_INCONNU'; end if;
  if p_etoiles is null or p_etoiles < 1 or p_etoiles > 3 then raise exception 'ETOILES_INVALIDES'; end if;
  if p_temps is null or p_temps < 5 or p_temps > 3600 then raise exception 'TEMPS_INVALIDE'; end if;
  if p_niveau > 0 and not exists (select 1 from public.porte_records r where r.member_id = me and r.niveau = p_niveau - 1) then
    raise exception 'NIVEAU_FERME';
  end if;
  select * into avant from public.porte_records r where r.member_id = me and r.niveau = p_niveau for update;
  v_gain := greatest(0, p_etoiles - coalesce(avant.etoiles, 0));
  if avant.member_id is null then
    insert into public.porte_records (family_id, member_id, niveau, etoiles, temps) values (p_family, me, p_niveau, p_etoiles, round(p_temps, 1));
  elsif p_etoiles > avant.etoiles or (p_etoiles = avant.etoiles and p_temps < avant.temps) then
    update public.porte_records set etoiles = p_etoiles, temps = round(p_temps, 1), updated_at = now() where member_id = me and niveau = p_niveau;
  end if;
  if v_gain > 0 then perform private.award(p_family, me, 'porte', v_gain); end if;
  return jsonb_build_object('gain', v_gain);
end;
$$;

revoke execute on function public.porte_fini(uuid, int, int, numeric) from public, anon;
grant execute on function public.porte_fini(uuid, int, int, numeric) to authenticated;
