-- NIDOO — Des habits en plus à la boutique : fausse fourrure, trench, blazer, robe, jupe, short
-- (prix alignés avec src/lib/data.ts).
insert into private.shop_catalog (key, cost, qty) values
  ('mode:fourrure', 30, null), ('mode:trench', 28, null), ('mode:blazer', 24, null),
  ('mode:robe', 22, null), ('mode:jupe', 18, null), ('mode:short', 16, null)
on conflict (key) do update set cost = excluded.cost, qty = excluded.qty;
