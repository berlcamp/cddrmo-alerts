-- LOCAL ONLY. Bypasses the Google-only claim flow so local sessions can be tested.
-- Usage: psql "$DB_URL" -v ON_ERROR_STOP=1 -v admin_uid=<uuid> -v encoder_uid=<uuid> -f supabase/tests/local_staff_link.sql
insert into cdrrmo.users (email, full_name, role)
values ('local-encoder@example.test', 'Local Encoder', 'encoder')
on conflict (email) do nothing;

update cdrrmo.users set auth_user_id = :'admin_uid', last_sign_in_at = now() where email = 'berlcamp@gmail.com';
update cdrrmo.users set auth_user_id = :'encoder_uid', last_sign_in_at = now() where email = 'local-encoder@example.test';

select email, role, auth_user_id is not null as linked from cdrrmo.users order by email;
