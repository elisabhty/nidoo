-- NIDOO — La guirlande lumineuse quitte la boutique
-- Le haut de la maison accueille désormais le fil à photos. La guirlande lumineuse n'est plus dessinée :
-- on la retire du catalogue (elle ne peut plus être achetée ni offerte par le défi de la semaine)
-- et les familles qui l'avaient achetée récupèrent leurs 25 étoiles.

update public.families f set stars = f.stars + c.cost
  from public.house_catalog c
  where c.key = 'guirlande'
    and exists (select 1 from public.house_items h where h.family_id = f.id and h.item_key = 'guirlande');
delete from public.house_items where item_key = 'guirlande';
delete from public.house_catalog where key = 'guirlande';
