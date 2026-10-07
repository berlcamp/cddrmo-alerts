-- LOCAL Supabase stack ONLY. Never run against the shared remote project.
-- Creates 3 auth users so supabase/tests/rls_test.sql has users to borrow. Idempotent.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'local-user-1@example.test', now() - interval '3 minutes', now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'local-user-2@example.test', now() - interval '2 minutes', now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'local-user-3@example.test', now() - interval '1 minute', now())
on conflict (id) do nothing;
