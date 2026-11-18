begin;
do $test$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); f uuid; m uuid; photo uuid:=gen_random_uuid(); n int; rejected boolean:=false;
begin
 insert into auth.users(id,email) values(u,'house-photo-test-'||u||'@example.invalid');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('role','authenticated',true);
 f:=public.create_family('Photo test rollback','maison','Test','panda','lavande');
 select id into m from public.members where family_id=f and user_id=u;
 insert into public.moments(id,family_id,member_id,image_path) values(photo,f,m,f::text||'/test.jpg');
 update public.families set house_photo_ids=array['m:'||photo::text] where id=f;
 if not exists(select 1 from public.families where id=f and house_photo_ids=array['m:'||photo::text]) then raise exception 'Selection not saved';end if;
 update public.families set house_photo_ids='{}' where id=f;
 if not exists(select 1 from public.moments where id=photo) then raise exception 'Source removed';end if;
 begin
  update public.families set house_photo_ids=array_fill('m:test'::text,array[7]) where id=f;
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Seven photos accepted';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 update public.families set house_photo_ids=null where id=f;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Outsider changed photo selection';end if;
end $test$;
rollback;
