-- À APPLIQUER : pas encore dans la base au 25 novembre (l'accord d'Elisa est attendu). En attendant, l'appli fait
-- sans : seul un responsable renouvelle le code (src/lib/invitation.ts). Retirer ces deux lignes une fois appliquée.
--
-- Le code d'invitation se renouvelle tout seul quand il a expiré, pour n'importe quel membre de la maison
-- (Elisa, 25 novembre : « renouvelle le code automatiquement, il faut pas qu'il soit barré » puis « tu peux le
-- mettre directement »). Avant, seul un responsable pouvait créer un code : un autre membre voyait un code expiré.
-- Le code ne donne que le droit de demander à entrer : un responsable accepte toujours chaque personne.
-- Il vaut toujours 7 jours ; un code encore valable n'est jamais changé par cette fonction.
create function public.renew_invite_if_expired(p_family uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  code text;
begin
  if not private.is_member(p_family) then raise exception 'PAS_MEMBRE'; end if;
  update public.families f
     set invite_code = private.gen_invite_code(), invite_expires_at = now() + interval '7 days'
   where f.id = p_family and f.invite_expires_at < now();
  select f.invite_code into code from public.families f where f.id = p_family;
  return code;
end;
$$;

revoke execute on function public.renew_invite_if_expired(uuid) from public, anon, authenticated;
grant execute on function public.renew_invite_if_expired(uuid) to authenticated;
