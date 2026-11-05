insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','owner@example.test'),('22222222-2222-4222-8222-222222222222','visitor@example.test');
insert into public.bb_admins values('11111111-1111-4111-8111-111111111111');
set role anon;
do $$ begin
 if (select count(*) from public.bb_settings)<>2 then raise exception 'Public content is unreadable'; end if;
 begin insert into public.bb_projects(title,category,images) values('bad','bad','["x"]');raise exception 'Anonymous write was allowed';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('portfolio-images','bad');raise exception 'Anonymous upload was allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
set role authenticated;
do $$ declare n integer;begin
 if public.bb_is_admin() then raise exception 'Visitor treated as owner'; end if;
 if (select count(*) from public.bb_admins)<>0 then raise exception 'Owner list leaked'; end if;
 begin insert into public.bb_admins values(auth.uid());raise exception 'Self-promotion allowed';exception when insufficient_privilege then null;end;
 begin perform public.bb_patch_info('{"name":"bad"}');raise exception 'Visitor patch allowed';exception when insufficient_privilege then null;end;
 update public.bb_settings set value='{}' where id='site';get diagnostics n=row_count;if n<>0 then raise exception 'Visitor changed site';end if;
 begin insert into public.bb_projects(title,category,images) values('bad','bad','["x"]');raise exception 'Visitor write allowed';exception when insufficient_privilege then null;end;
 begin insert into storage.objects(bucket_id,name) values('portfolio-images','bad');raise exception 'Visitor upload allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set role authenticated;
do $$ begin
 if not public.bb_is_admin() then raise exception 'Owner blocked';end if;
 perform public.bb_patch_info('{"name":"Owner saved","email":"owner@example.test"}');
 perform public.bb_patch_info('{"intro":"New intro"}');
 if (select value->>'email' from public.bb_settings where id='info')<>'owner@example.test' then raise exception 'Partial update lost email';end if;
 insert into public.bb_projects(id,title,category,images) values('33333333-3333-4333-8333-333333333333','Work','Branding','["image.png"]');
 update public.bb_projects set title='Updated' where id='33333333-3333-4333-8333-333333333333';
 insert into storage.objects(bucket_id,name) values('portfolio-images','owner.png');
 begin insert into storage.objects(bucket_id,name) values('another-bucket','forbidden.png');raise exception 'Owner escaped bucket scope';exception when insufficient_privilege then null;end;
 delete from storage.objects where name='owner.png';
 delete from public.bb_projects where id='33333333-3333-4333-8333-333333333333';
end $$;
reset role;
select 'PASS: public reads, denied anonymous/nonowner writes, no self-promotion, owner CRUD, partial updates, storage scope' as result;
