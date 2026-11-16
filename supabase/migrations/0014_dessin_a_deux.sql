-- NIDOO — Dessiner à deux
-- Les traits passent en direct par des canaux privés de Supabase Realtime (broadcast), sans rien écrire en base :
--   nidoo:famille:<famille>             les invitations « viens dessiner avec moi »
--   nidoo:dessin:<famille>:<séance>     la feuille partagée
-- Seuls les membres de la famille peuvent écouter ou parler sur ces canaux.
-- Dans le tableau de bord Supabase : Realtime > Settings, décocher « Allow public access » pour n'accepter que les canaux privés.

create policy "nidoo : les membres écoutent leur famille"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) like 'nidoo:%'
  and private.is_member(nullif(split_part((select realtime.topic()), ':', 3), '')::uuid)
);

create policy "nidoo : les membres parlent à leur famille"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) like 'nidoo:%'
  and private.is_member(nullif(split_part((select realtime.topic()), ':', 3), '')::uuid)
);
