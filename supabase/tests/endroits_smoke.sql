-- « Nos adresses » (20261126013000_endroits.sql) : la famille les voit et les change, personne d'autre ; un nom ne
-- sert qu'une fois ; les widgets lisent « École » à la place de la rue. Tout est annulé à la fin (rollback).
begin;
do $test$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); f uuid; m uuid; e uuid; n int; rejected boolean:=false; etat jsonb;
begin
 insert into auth.users(id,email) values(u,'endroits-test-'||u||'@example.invalid'),(outsider,'endroits-out-'||outsider||'@example.invalid');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('role','authenticated',true);
 f:=public.create_family('Endroits test rollback','maison','Test','panda','lavande');
 select id into m from public.members where family_id=f and user_id=u;
 insert into public.endroits(family_id,nom,adresse,lat,lon) values(f,'École','3 Rue des Écoles, 74000 Annecy',45.9061,6.1453) returning id into e;
 begin
  insert into public.endroits(family_id,nom,lat,lon) values(f,'école',45.91,6.15);
 exception when unique_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Duplicate name accepted';end if;
 update public.endroits set rayon_m=300 where id=e;
 if not exists(select 1 from public.endroits where id=e and rayon_m=300) then raise exception 'Update lost';end if;
 -- Léa (moi ici) à 120 m de l'école : le widget lit « École »
 perform public.position_partager(f,45.9061+120/111195.0,6.1453,20,'Avenue d''Albigny','Annecy',80);
 perform set_config('role','postgres',true);
 etat:=private.widget_etat(f,m);
 if etat->'positions'->0->>'l'<>'École' or etat->'positions'->0->'v'<>'null'::jsonb then raise exception 'Widget does not use place name: %',etat->'positions';end if;
 update public.endroits set lat=46.5 where id=e;
 etat:=private.widget_etat(f,m);
 if etat->'positions'->0->>'l'<>'Avenue d''Albigny' then raise exception 'Widget kept place name when away: %',etat->'positions';end if;
 -- quelqu'un d'une autre maison ne voit ni ne change rien
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',outsider::text,true);perform set_config('role','authenticated',true);
 select count(*) into n from public.endroits where family_id=f;
 if n<>0 then raise exception 'Outsider reads places';end if;
 update public.endroits set nom='Piraté' where id=e;get diagnostics n=row_count;
 if n<>0 then raise exception 'Outsider changed place';end if;
 rejected:=false;
 begin
  insert into public.endroits(family_id,nom,lat,lon) values(f,'Intrus',45.9,6.1);
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Outsider added place';end if;
end $test$;
rollback;
