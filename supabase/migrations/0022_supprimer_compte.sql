-- « Supprimer mon compte » (exigé par l'App Store, règle 5.1.1(v)).
--
-- On efface la personne de toutes ses maisons, puis son compte. Attention : families.created_by
-- supprime la maison en cascade avec le compte de sa créatrice. Avant d'effacer le compte, chaque
-- maison qu'elle a créée passe donc à un autre membre qui a l'appli ; une maison où il ne reste
-- personne avec l'appli (seulement elle, ou des enfants sans téléphone) est supprimée.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := auth.uid();
  f record;
  suivant uuid;
begin
  if moi is null then raise exception 'NON_CONNECTE'; end if;

  -- 1. Les maisons où il ne resterait personne avec l'appli : elles partent avec le compte.
  delete from public.families fa
   where (fa.created_by = moi or exists (select 1 from public.members m where m.family_id = fa.id and m.user_id = moi))
     and not exists (select 1 from public.members m where m.family_id = fa.id and m.user_id is not null and m.user_id <> moi);

  -- 2. Les maisons que j'ai créées et qui continuent : un autre membre en devient le créateur.
  for f in select fa.id from public.families fa where fa.created_by = moi loop
    select m.user_id into suivant from public.members m
     where m.family_id = f.id and m.user_id is not null and m.user_id <> moi
     order by (m.role = 'responsable') desc, m.joined_at
     limit 1;
    update public.families set created_by = suivant where id = f.id;
  end loop;

  -- 3. Les enfants sans téléphone que je gérais passent à un adulte qui reste.
  update public.members c
     set managed_by = (select r.id from public.members r
                        where r.family_id = c.family_id and r.user_id is not null and r.user_id <> moi
                        order by (r.role = 'responsable') desc, r.joined_at limit 1)
   where c.managed_by in (select x.id from public.members x where x.user_id = moi);

  -- 4. Mes profils (avec mes messages, photos, vocaux, dessins…), puis le compte lui-même.
  --    S'il n'y a plus de responsable, private.keep_admin en nomme un.
  delete from public.members where user_id = moi;
  delete from public.join_requests where user_id = moi;
  delete from auth.users where id = moi;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
