-- Clés widget : l'heure réelle de création (deux clés demandées coup sur coup gardent leur ordre),
-- et la clé qu'on vient de donner n'est jamais celle qu'on retire.
alter table private.widget_keys alter column created_at set default clock_timestamp();

create or replace function public.widget_cle(p_family uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid := private.my_member(p_family);
  cle text;
  h bytea;
begin
  if uid is null or mid is null then raise exception 'PAS_MEMBRE'; end if;
  cle := 'nw_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  h := sha256(convert_to(cle, 'UTF8'));
  insert into private.widget_keys (key_hash, user_id, family_id, member_id) values (h, uid, p_family, mid);
  -- au plus 4 clés par personne et par maison (téléphone, tablette, réinstallation…) : les plus anciennes s'en vont
  delete from private.widget_keys w
    where w.member_id = mid and w.key_hash <> h
      and w.key_hash not in (
        select w2.key_hash from private.widget_keys w2 where w2.member_id = mid order by w2.created_at desc limit 4
      );
  return cle;
end;
$$;
