-- Draft reports: new reports start as staff-only drafts pre-filled from the latest published report,
-- and reach the public site only when a staff member publishes them.

-- Existing reports were already public, so they backfill as published; new rows default to draft.
alter table cdrrmo.reports
  add column status text not null default 'published' check (status in ('draft', 'published')),
  add column published_at timestamptz;
update cdrrmo.reports set published_at = created_at where published_at is null;
alter table cdrrmo.reports alter column status set default 'draft';
create index reports_status_report_at_idx on cdrrmo.reports (status, report_at desc);

-- Publishing stamps published_at; a published report can never go back to draft.
create or replace function cdrrmo.stamp_published_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.published_at := case when new.status = 'published' then coalesce(new.published_at, now()) end;
    return new;
  end if;
  if old.status = 'published' and new.status = 'draft' then
    raise exception 'A published report cannot be turned back into a draft';
  end if;
  if old.status = 'draft' and new.status = 'published' then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  return new;
end $$;
create trigger stamp_published_at before insert or update on cdrrmo.reports
  for each row execute function cdrrmo.stamp_published_at();

-- Read access: anyone reads published reports and their rows; staff also read drafts.
-- anon evaluates is_staff() in these policies (always false without a session).
grant execute on function cdrrmo.is_staff() to anon;
drop policy reports_read on cdrrmo.reports;
create policy reports_read on cdrrmo.reports for select to anon, authenticated
  using (status = 'published' or (select cdrrmo.is_staff()));

drop policy report_entries_read on cdrrmo.report_entries;
create policy report_entries_read on cdrrmo.report_entries for select to anon, authenticated
  using (
    exists (select 1 from cdrrmo.reports r where r.id = report_id and r.status = 'published')
    or (select cdrrmo.is_staff())
  );

-- Realtime: every change goes to the staff-only topic cdrrmo-staff:report:<id> (the encoder listens there);
-- only published reports also go to the public cdrrmo:* topics. Publishing announces the report publicly.
create or replace function cdrrmo.broadcast_entry_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_row cdrrmo.report_entries := case when tg_op = 'DELETE' then old else new end;
  v_payload jsonb := case when tg_op = 'DELETE' then jsonb_build_object('id', old.id, 'deleted', true) else to_jsonb(new) end;
  v_status text;
begin
  select r.status into v_status from cdrrmo.reports r where r.id = v_row.report_id;
  perform realtime.send(v_payload, 'entry', 'cdrrmo-staff:report:' || v_row.report_id, true);
  -- A cascaded delete may run after its report is gone (null status): an id-only notice is safe to send.
  if v_status is distinct from 'draft' then
    perform realtime.send(v_payload, 'entry', 'cdrrmo:report:' || v_row.report_id, true);
  end if;
  return v_row;
end $$;

create or replace function cdrrmo.broadcast_report_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'report', 'cdrrmo-staff:report:' || old.id, true);
    if old.status = 'published' then
      perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'report', 'cdrrmo:report:' || old.id, true);
      perform realtime.send(jsonb_build_object('id', old.id, 'report_at', old.report_at, 'op', 'DELETE'), 'reports_changed', 'cdrrmo:reports', true);
    end if;
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'report', 'cdrrmo-staff:report:' || new.id, true);
  if new.status = 'published' then
    perform realtime.send(to_jsonb(new), 'report', 'cdrrmo:report:' || new.id, true);
    if tg_op = 'INSERT' or new.report_at is distinct from old.report_at or new.status is distinct from old.status then
      perform realtime.send(jsonb_build_object('id', new.id, 'report_at', new.report_at, 'op', tg_op), 'reports_changed', 'cdrrmo:reports', true);
    end if;
  end if;
  return new;
end $$;

revoke execute on function cdrrmo.broadcast_entry_change(), cdrrmo.broadcast_report_change(), cdrrmo.stamp_published_at()
  from public, anon, authenticated;

-- Only active staff may listen on the cdrrmo-staff:* topics (no insert policy: clients cannot send).
drop policy if exists "cdrrmo staff broadcast read" on realtime.messages;
create policy "cdrrmo staff broadcast read" on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'cdrrmo-staff:%' and extension = 'broadcast' and (select cdrrmo.is_staff()));

-- New reports start as drafts, pre-filled with the barangay rows and remarks of the latest published report.
create or replace function cdrrmo.create_report(
  p_report_at timestamptz,
  p_prepared_by_name text,
  p_prepared_by_position text
) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_staff_id uuid;
  v_report_id uuid;
  v_source_id uuid;
  v_source_remarks text;
begin
  select s.id into v_staff_id from cdrrmo.current_staff() s;
  if v_staff_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select r.id, r.remarks into v_source_id, v_source_remarks
    from cdrrmo.reports r
   where r.status = 'published'
   order by r.report_at desc
   limit 1;
  insert into cdrrmo.reports (report_at, prepared_by_name, prepared_by_position, remarks, status, created_by, updated_by)
  values (
    p_report_at,
    coalesce(p_prepared_by_name, ''),
    coalesce(nullif(trim(p_prepared_by_position), ''), 'Radio Controller on Duty'),
    coalesce(v_source_remarks, ''),
    'draft',
    v_staff_id,
    v_staff_id
  )
  returning id into v_report_id;
  perform cdrrmo.add_missing_barangays(v_report_id);
  if v_source_id is not null then
    update cdrrmo.report_entries e
       set responded = s.responded,
           weather_option_id = s.weather_option_id,
           wind_option_id = s.wind_option_id,
           road = s.road,
           river = s.river,
           coastal = s.coastal,
           power = s.power,
           remarks = s.remarks
      from cdrrmo.report_entries s
     where e.report_id = v_report_id
       and s.report_id = v_source_id
       and s.barangay_id = e.barangay_id;
  end if;
  return v_report_id;
end $$;

notify pgrst, 'reload schema';
