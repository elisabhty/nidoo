begin;
do $test$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); f uuid; m uuid; e uuid:=gen_random_uuid(); n int; rejected boolean:=false;
begin
 insert into auth.users(id,email) values(u,'event-sticker-test-'||u||'@example.invalid');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('role','authenticated',true);
 f:=public.create_family('Sticker test rollback','maison','Test','panda','lavande');
 select id into m from public.members where family_id=f and user_id=u;
 insert into public.events(id,family_id,created_by,title,kind,starts_at,sticker) values(e,f,m,'Pique-nique','evenement',now()+interval '1 day','panda-fete');
 update public.events set sticker='soleil' where id=e;
 if not exists(select 1 from public.events where id=e and sticker='soleil' and title='Pique-nique') then raise exception 'Sticker update lost event';end if;
 begin
  update public.events set sticker='../invalid' where id=e;
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Invalid sticker key accepted';end if;
 update public.events set sticker=null where id=e;
 if not exists(select 1 from public.events where id=e and sticker is null) then raise exception 'Default icon not restored';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 update public.events set sticker='panda-fete' where id=e;get diagnostics n=row_count;
 if n<>0 then raise exception 'Outsider changed event';end if;
end $test$;
rollback;
