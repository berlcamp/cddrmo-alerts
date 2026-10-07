-- Staff helpers (security definer: they read cdrrmo.users regardless of the caller's RLS)
create or replace function cdrrmo.current_staff() returns setof cdrrmo.users
language sql stable security definer set search_path = '' as $$
  select u.* from cdrrmo.users u
  where u.auth_user_id = (select auth.uid()) and u.is_active
  limit 1
$$;

create or replace function cdrrmo.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cdrrmo.users u
    where u.auth_user_id = (select auth.uid()) and u.is_active
  )
$$;

create or replace function cdrrmo.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cdrrmo.users u
    where u.auth_user_id = (select auth.uid()) and u.is_active and u.role = 'super_admin'
  )
$$;

-- Links the signed-in Google account to its allowlisted staff row (case-insensitive email).
create or replace function cdrrmo.claim_staff_account() returns setof cdrrmo.users
language sql volatile security definer set search_path = '' as $$
  with c as (
    select
      (select auth.uid()) as uid,
      lower(coalesce((select auth.jwt()) ->> 'email', '')) as email,
      coalesce((select auth.jwt()) -> 'app_metadata', '{}'::jsonb) as app
  )
  update cdrrmo.users u
     set auth_user_id = c.uid, last_sign_in_at = now()
    from c
   where c.uid is not null
     and c.email <> ''
     and (c.app ->> 'provider' = 'google' or coalesce(c.app -> 'providers', '[]'::jsonb) ? 'google')
     and u.email = c.email
     and u.is_active
     and (u.auth_user_id is null or u.auth_user_id = c.uid)
  returning u.*
$$;

-- Adds one "No response" entry per active barangay missing from the report.
create or replace function cdrrmo.add_missing_barangays(p_report_id uuid) returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_staff_id uuid;
  v_count integer;
begin
  select s.id into v_staff_id from cdrrmo.current_staff() s;
  if v_staff_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into cdrrmo.report_entries
    (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal, updated_by)
  select p_report_id, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal, v_staff_id
  from cdrrmo.barangays b
  join cdrrmo.zones z on z.id = b.zone_id
  where b.is_active
    and not exists (
      select 1 from cdrrmo.report_entries e
      where e.report_id = p_report_id and e.barangay_id = b.id
    );
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function cdrrmo.create_report(
  p_report_at timestamptz,
  p_prepared_by_name text,
  p_prepared_by_position text
) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_staff_id uuid;
  v_report_id uuid;
begin
  select s.id into v_staff_id from cdrrmo.current_staff() s;
  if v_staff_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into cdrrmo.reports (report_at, prepared_by_name, prepared_by_position, created_by, updated_by)
  values (
    p_report_at,
    coalesce(p_prepared_by_name, ''),
    coalesce(nullif(trim(p_prepared_by_position), ''), 'Radio Controller on Duty'),
    v_staff_id,
    v_staff_id
  )
  returning id into v_report_id;
  perform cdrrmo.add_missing_barangays(v_report_id);
  return v_report_id;
end $$;

-- Row-level security
alter table cdrrmo.zones enable row level security;
alter table cdrrmo.barangays enable row level security;
alter table cdrrmo.condition_options enable row level security;
alter table cdrrmo.settings enable row level security;
alter table cdrrmo.users enable row level security;
alter table cdrrmo.reports enable row level security;
alter table cdrrmo.report_entries enable row level security;

-- Reference tables: everyone reads, the super admin writes.
do $$
declare t text;
begin
  foreach t in array array['zones', 'barangays', 'condition_options', 'settings'] loop
    execute format('create policy %s_read on cdrrmo.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_super_admin()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_super_admin())) with check ((select cdrrmo.is_super_admin()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_super_admin()))', t, t);
  end loop;
end $$;

-- Reports and entries: public read, staff write, super admin delete.
do $$
declare t text;
begin
  foreach t in array array['reports', 'report_entries'] loop
    execute format('create policy %s_read on cdrrmo.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_staff())) with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_super_admin()))', t, t);
  end loop;
end $$;

-- Users: own row, or everything for the super admin.
create policy users_read on cdrrmo.users for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select cdrrmo.is_super_admin()));
create policy users_insert on cdrrmo.users for insert to authenticated
  with check ((select cdrrmo.is_super_admin()));
create policy users_update on cdrrmo.users for update to authenticated
  using ((select cdrrmo.is_super_admin())) with check ((select cdrrmo.is_super_admin()));
create policy users_delete on cdrrmo.users for delete to authenticated
  using ((select cdrrmo.is_super_admin()));

-- Grants
grant usage on schema cdrrmo to anon, authenticated, service_role;
grant select on cdrrmo.zones, cdrrmo.barangays, cdrrmo.condition_options, cdrrmo.settings,
  cdrrmo.reports, cdrrmo.report_entries to anon;
grant select, insert, update, delete on all tables in schema cdrrmo to authenticated;
grant all on all tables in schema cdrrmo to service_role;

alter default privileges in schema cdrrmo revoke execute on functions from public;
revoke execute on all functions in schema cdrrmo from public, anon, authenticated;
grant execute on function
  cdrrmo.current_staff(),
  cdrrmo.is_staff(),
  cdrrmo.is_super_admin(),
  cdrrmo.claim_staff_account(),
  cdrrmo.create_report(timestamptz, text, text),
  cdrrmo.add_missing_barangays(uuid)
to authenticated;

notify pgrst, 'reload schema';
