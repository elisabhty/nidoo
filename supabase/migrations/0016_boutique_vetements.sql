-- NIDOO — La boutique s'agrandit : boucles d'oreilles, manteau et chaussures (prix alignés avec src/lib/data.ts).
insert into private.shop_catalog (key, cost, qty) values
  ('mode:boucles', 10, null), ('mode:manteau', 25, null), ('mode:bottes', 14, null), ('mode:baskets', 12, null)
on conflict (key) do update set cost = excluded.cost, qty = excluded.qty;
