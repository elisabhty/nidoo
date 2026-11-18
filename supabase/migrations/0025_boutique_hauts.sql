-- NIDOO — Des hauts à la boutique : col roulé, pull torsadé, chemise rayée, gilet à perles, marinière, sweat
-- (prix alignés avec src/lib/data.ts).
insert into private.shop_catalog (key, cost, qty) values
  ('mode:colroule', 20, null), ('mode:torsade', 20, null), ('mode:chemise', 18, null),
  ('mode:gilet', 18, null), ('mode:mariniere', 16, null), ('mode:sweat', 14, null)
on conflict (key) do update set cost = excluded.cost, qty = excluded.qty;
