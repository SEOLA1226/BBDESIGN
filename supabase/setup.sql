-- Run once in your own Supabase project's SQL Editor; safe to re-run.
-- This script never assigns an administrator automatically.
begin;
create table if not exists public.bb_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.bb_admins enable row level security;
revoke all on public.bb_admins from anon, authenticated;
grant select on public.bb_admins to authenticated;
drop policy if exists bb_admin_self on public.bb_admins;
create policy bb_admin_self on public.bb_admins for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.bb_is_admin() returns boolean
 language sql stable security definer set search_path=''
 as $$ select exists(select 1 from public.bb_admins where user_id=(select auth.uid())); $$;
revoke all on function public.bb_is_admin() from public;
grant execute on function public.bb_is_admin() to anon, authenticated;

create table if not exists public.bb_settings (
 id text primary key check (id in ('info','site')),
 value jsonb not null check (jsonb_typeof(value)='object')
);
create table if not exists public.bb_projects (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(title) between 1 and 120),
 category text not null check (length(category) between 1 and 60),
 description text not null default '' check (length(description)<=5000),
 images jsonb not null check (jsonb_typeof(images)='array' and jsonb_array_length(images) between 1 and 10),
 created timestamptz not null default now()
);
alter table public.bb_settings enable row level security;
alter table public.bb_projects enable row level security;
revoke all on public.bb_settings, public.bb_projects from anon, authenticated;
grant select on public.bb_settings, public.bb_projects to anon, authenticated;
grant insert,update,delete on public.bb_settings, public.bb_projects to authenticated;
drop policy if exists bb_settings_read on public.bb_settings;
create policy bb_settings_read on public.bb_settings for select to anon,authenticated using (true);
drop policy if exists bb_settings_owner on public.bb_settings;
create policy bb_settings_owner on public.bb_settings for all to authenticated using ((select public.bb_is_admin())) with check ((select public.bb_is_admin()));
drop policy if exists bb_projects_read on public.bb_projects;
create policy bb_projects_read on public.bb_projects for select to anon,authenticated using (true);
drop policy if exists bb_projects_owner on public.bb_projects;
create policy bb_projects_owner on public.bb_projects for all to authenticated using ((select public.bb_is_admin())) with check ((select public.bb_is_admin()));

create or replace function public.bb_patch_info(p_patch jsonb) returns void
 language plpgsql security invoker set search_path='' as $$
begin
 if not public.bb_is_admin() then raise insufficient_privilege using message='Administrator access required'; end if;
 if jsonb_typeof(p_patch)<>'object' then raise exception 'Expected object'; end if;
 update public.bb_settings set value=value || p_patch where id='info';
end;
$$;
revoke all on function public.bb_patch_info(jsonb) from public;
grant execute on function public.bb_patch_info(jsonb) to authenticated;

insert into public.bb_settings(id,value) values
 ('info','{"name":"BBDESIGN","intro":"단순하게, 분명하게.\n오래 남는 디자인을 만듭니다.","body":"브랜드의 본질을 발견하고,\n필요한 것만 남기는 디자인을 합니다.","notice":"새로운 프로젝트 문의를 받고 있습니다.","email":"","contactHeading":"LET’S MAKE\nSOMETHING GOOD.","contactBody":"함께 만들고 싶은 것이 있나요?\n프로젝트와 협업 이야기를 들려주세요."}'::jsonb),
 ('site','{"sections":[{"id":"info","label":"INFO","visible":true},{"id":"contact","label":"CONTACT","visible":true},{"id":"portfolio","label":"PORTFOLIO","visible":true}],"previewCount":6,"showExamples":true}'::jsonb)
on conflict(id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('portfolio-images','portfolio-images',true,8388608,array['image/jpeg','image/png','image/gif','image/webp'])
 on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists bb_images_read on storage.objects;
create policy bb_images_read on storage.objects for select to anon,authenticated using (bucket_id='portfolio-images');
drop policy if exists bb_images_insert on storage.objects;
create policy bb_images_insert on storage.objects for insert to authenticated with check (bucket_id='portfolio-images' and (select public.bb_is_admin()));
drop policy if exists bb_images_update on storage.objects;
create policy bb_images_update on storage.objects for update to authenticated using (bucket_id='portfolio-images' and (select public.bb_is_admin())) with check (bucket_id='portfolio-images' and (select public.bb_is_admin()));
drop policy if exists bb_images_delete on storage.objects;
create policy bb_images_delete on storage.objects for delete to authenticated using (bucket_id='portfolio-images' and (select public.bb_is_admin()));
commit;
