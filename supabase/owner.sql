-- First create your user under Authentication > Users > Add user.
-- Replace only YOUR_EMAIL_HERE with that user's email, then run this query.
insert into public.bb_admins(user_id)
 select id from auth.users where lower(email)=lower('YOUR_EMAIL_HERE')
 on conflict do nothing;
-- This must return your email. Zero rows means the email/user does not match.
select u.email from public.bb_admins a join auth.users u on u.id=a.user_id;
