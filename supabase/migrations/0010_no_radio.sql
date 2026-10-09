-- Barangays that cannot answer the radio roll call. Copied onto each report entry (like monitors_coastal)
-- so a report keeps the flag it was created with.
alter table cdrrmo.barangays add column no_radio boolean not null default false;
alter table cdrrmo.report_entries add column no_radio boolean not null default false;

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
    (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal, no_radio, updated_by)
  select p_report_id, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal, b.no_radio, v_staff_id
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

notify pgrst, 'reload schema';
