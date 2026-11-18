begin;
do $test$
declare
 u uuid := gen_random_uuid(); outsider uuid := gen_random_uuid(); f uuid; d uuid; m uuid;
 source uuid := gen_random_uuid(); copy uuid := gen_random_uuid(); written uuid := gen_random_uuid(); n int; rejected boolean := false;
begin
 insert into auth.users(id,email) values(u,'nidoo-test-'||u||'@example.invalid');
 perform set_config('request.jwt.claims',json_build_object('sub',u,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true); perform set_config('role','authenticated',true);
 f := public.create_family('Test media rollback','maison','Test','panda','lavande');
 select id into m from public.members where family_id=f and user_id=u;
 d := public.create_folder(f,'Souvenirs test',null,array[m]);
 insert into public.moments(id,family_id,member_id,image_path) values(source,f,m,f::text||'/test.jpg');
 insert into public.folder_items(id,folder_id,author_id,kind,image_path,source_moment_id) values(copy,d,m,'photo',d::text||'/copy.jpg',source);
 insert into public.folder_items(folder_id,author_id,kind,image_path) values(d,m,'dessin',d::text||'/drawing.jpg');
 insert into public.folder_items(folder_id,author_id,kind,media_path) values(d,m,'audio',d::text||'/voice.m4a'),(d,m,'video',d::text||'/video.mp4');
 insert into public.folder_items(id,folder_id,author_id,kind,title) values(written,d,m,'note','Original');
 update public.folder_items set title='Updated' where id=written;
 if not exists(select 1 from public.folder_items where id=written and title='Updated') then raise exception 'Note update failed'; end if;
 update public.folder_items set image_path=d::text||'/copy.jpg' where id=copy;
 if exists(select 1 from public.folder_items where id=copy and image_path<>d::text||'/copy.jpg') then raise exception 'Saved photo mutated'; end if;
 update public.folder_items set title='Changed' where folder_id=d and kind in ('dessin','audio','video');
 if exists(select 1 from public.folder_items where folder_id=d and kind in ('dessin','audio','video') and title='Changed') then raise exception 'Saved media mutated'; end if;
 begin
  perform public.create_folder(f,'Nested',d,array[m]);
  raise exception 'Nested folder accepted';
 exception when others then
  if sqlerrm <> 'DOSSIERS_IMBRIQUES_INDISPONIBLES' then raise; end if;
 end;
 begin
  insert into public.folder_items(folder_id,author_id,kind,image_path) values(d,m,'audio',d::text||'/bad.jpg');
 exception when check_violation then rejected := true;
 end;
 if not rejected then raise exception 'Invalid audio accepted'; end if;
 delete from public.moments where id=source;
 select count(*) into n from public.folder_items where id=copy and source_moment_id is null and image_path=d::text||'/copy.jpg';
 if n<>1 then raise exception 'Deleting original lost folder copy'; end if;
 select count(*) into n from public.folder_items where folder_id=d;
 if n<>5 then raise exception 'Media persistence failed'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 select count(*) into n from public.folder_items where folder_id=d;
 if n<>0 then raise exception 'Outsider can read folder media'; end if;
end $test$;
rollback;
