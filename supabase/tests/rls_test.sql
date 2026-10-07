-- RLS / auth acceptance test. Run the whole file with the Supabase MCP execute_sql.
-- PASS = the call fails with exactly: RLS_TESTS_PASSED
-- (that final RAISE rolls back every fixture). Any other error names the failing check.
do $test$
declare
  v_taken uuid[];
  v_admin_auth uuid;
  v_encoder_auth uuid;
  v_outsider_auth uuid;
  v_report uuid;
  v_entry uuid;
  v_new_report uuid;
  n int;
begin
  select coalesce(array_agg(auth_user_id) filter (where auth_user_id is not null), '{}')
    into v_taken from cdrrmo.users;
  select auth_user_id into v_admin_auth from cdrrmo.users where email = 'berlcamp@gmail.com';
  if v_admin_auth is null then
    select id into v_admin_auth from auth.users where id <> all (v_taken) order by created_at limit 1;
    update cdrrmo.users set auth_user_id = v_admin_auth where email = 'berlcamp@gmail.com';
  end if;
  select id into v_encoder_auth from auth.users
    where id <> all (v_taken) and id <> v_admin_auth order by created_at limit 1;
  select id into v_outsider_auth from auth.users
    where id <> all (v_taken) and id not in (v_admin_auth, v_encoder_auth) order by created_at limit 1;
  if v_encoder_auth is null or v_outsider_auth is null then
    raise exception 'SETUP: need at least 3 auth users';
  end if;

  insert into cdrrmo.users (email, full_name, role) values ('rls-test-encoder@example.com', 'RLS Test Encoder', 'encoder');
  insert into cdrrmo.reports (report_at, prepared_by_name) values (now(), 'RLS fixture') returning id into v_report;
  insert into cdrrmo.report_entries (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal)
    select v_report, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal
    from cdrrmo.barangays b join cdrrmo.zones z on z.id = b.zone_id;
  select id into v_entry from cdrrmo.report_entries where report_id = v_report order by sort_order limit 1;

  ---------------------------------------------------------------- anon
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from cdrrmo.report_entries where report_id = v_report;
  if n = 0 then raise exception 'FAIL anon: cannot read report entries'; end if;
  select count(*) into n from cdrrmo.barangays;
  if n = 0 then raise exception 'FAIL anon: cannot read barangays'; end if;
  begin
    select count(*) into n from cdrrmo.users;
    if n > 0 then raise exception 'FAIL anon: can read users'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into cdrrmo.zones (name, sort_order) values ('rls-zone', 99);
    raise exception 'FAIL anon: inserted a zone';
  exception when insufficient_privilege then null;
  end;
  begin
    update cdrrmo.report_entries set remarks = 'anon' where id = v_entry;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FAIL anon: updated an entry'; end if;
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- outsider (Google user, not staff)
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_outsider_auth, 'role', 'authenticated', 'email', 'outsider@example.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  select count(*) into n from cdrrmo.report_entries where report_id = v_report;
  if n = 0 then raise exception 'FAIL outsider: cannot read entries'; end if;
  select count(*) into n from cdrrmo.users;
  if n > 0 then raise exception 'FAIL outsider: can read users'; end if;
  select count(*) into n from cdrrmo.claim_staff_account();
  if n > 0 then raise exception 'FAIL outsider: claimed a staff account'; end if;
  update cdrrmo.report_entries set remarks = 'outsider' where id = v_entry;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL outsider: updated an entry'; end if;
  begin
    insert into cdrrmo.reports (report_at) values (now());
    raise exception 'FAIL outsider: inserted a report';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cdrrmo.create_report(now(), 'x', 'y');
    raise exception 'FAIL outsider: create_report succeeded';
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- staff email via a non-Google provider must not claim
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_encoder_auth, 'role', 'authenticated', 'email', 'rls-test-encoder@example.com',
    'app_metadata', json_build_object('provider', 'email', 'providers', json_build_array('email')))::text, true);
  select count(*) into n from cdrrmo.claim_staff_account();
  if n > 0 then raise exception 'FAIL: non-Google sign-in claimed a staff account'; end if;

  ---------------------------------------------------------------- encoder (Google, mixed-case email)
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_encoder_auth, 'role', 'authenticated', 'email', 'RLS-Test-Encoder@Example.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  select count(*) into n from cdrrmo.claim_staff_account();
  if n <> 1 then raise exception 'FAIL encoder: could not claim staff account'; end if;
  if not cdrrmo.is_staff() then raise exception 'FAIL encoder: is_staff() false after claim'; end if;
  if cdrrmo.is_super_admin() then raise exception 'FAIL encoder: is_super_admin() true'; end if;
  update cdrrmo.report_entries set remarks = 'encoder', responded = true, road = 'passable' where id = v_entry;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL encoder: could not update entry'; end if;
  v_new_report := cdrrmo.create_report(now(), 'Encoder Test', '');
  select count(*) into n from cdrrmo.report_entries where report_id = v_new_report;
  if n <> (select count(*) from cdrrmo.barangays where is_active) then
    raise exception 'FAIL encoder: create_report made % entries', n;
  end if;
  if (select prepared_by_position from cdrrmo.reports where id = v_new_report) <> 'Radio Controller on Duty' then
    raise exception 'FAIL encoder: blank position not defaulted';
  end if;
  select count(*) into n from cdrrmo.users;
  if n <> 1 then raise exception 'FAIL encoder: sees % user rows (expected only own)', n; end if;
  delete from cdrrmo.reports where id = v_report;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL encoder: deleted a report'; end if;
  update cdrrmo.barangays set callsign = callsign;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL encoder: updated barangays'; end if;
  begin
    insert into cdrrmo.users (email, role) values ('x@example.com', 'encoder');
    raise exception 'FAIL encoder: added a user';
  exception when insufficient_privilege then null;
  end;

  ---------------------------------------------------------------- trigger: no response clears conditions
  update cdrrmo.report_entries set responded = false where id = v_entry;
  if (select road from cdrrmo.report_entries where id = v_entry) is not null then
    raise exception 'FAIL trigger: road not cleared on no response';
  end if;

  ---------------------------------------------------------------- super admin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_auth, 'role', 'authenticated', 'email', 'berlcamp@gmail.com',
    'app_metadata', json_build_object('provider', 'google'))::text, true);
  if not cdrrmo.is_super_admin() then raise exception 'FAIL admin: is_super_admin() false'; end if;
  select count(*) into n from cdrrmo.users;
  if n < 2 then raise exception 'FAIL admin: cannot list users'; end if;
  update cdrrmo.barangays set callsign = callsign;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FAIL admin: cannot update barangays'; end if;
  begin
    update cdrrmo.users set is_active = false where email = 'berlcamp@gmail.com';
    raise exception 'FAIL admin: super admin was deactivated';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    insert into cdrrmo.users (email, role) values ('second-admin@example.com', 'super_admin');
    raise exception 'FAIL admin: second super admin allowed';
  exception when check_violation then null;
  end;
  delete from cdrrmo.reports where id = v_report;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL admin: could not delete report'; end if;

  raise exception 'RLS_TESTS_PASSED';
end
$test$;
