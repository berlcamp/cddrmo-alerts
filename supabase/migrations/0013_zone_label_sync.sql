-- Report rows copy their zone's name and order when created. Keep those copies in step with Settings: renaming or
-- reordering a zone, or moving a barangay to another zone, updates every report row so the public pages always show
-- the zone labels Settings shows.

-- A zone-only sync is not an edit to the roll call: it keeps the row's updated_at (and so the report's
-- "last updated" time). Live viewers still accept the change, since an equal updated_at is not older.
drop trigger set_updated_at on cdrrmo.report_entries;
create trigger set_updated_at before update on cdrrmo.report_entries
  for each row
  when ((to_jsonb(old) - 'zone_name' - 'zone_sort' - 'updated_at') is distinct from (to_jsonb(new) - 'zone_name' - 'zone_sort' - 'updated_at'))
  execute function cdrrmo.set_updated_at();

create or replace function cdrrmo.sync_entry_zones() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update cdrrmo.report_entries e
  set zone_name = z.name, zone_sort = z.sort_order
  from cdrrmo.barangays b
  join cdrrmo.zones z on z.id = b.zone_id
  where e.barangay_id = b.id
    and (case when tg_table_name = 'zones' then z.id else b.id end) = new.id
    and (e.zone_name, e.zone_sort) is distinct from (z.name, z.sort_order);
  return null;
end $$;

create trigger sync_entry_zones after update of name, sort_order on cdrrmo.zones
  for each row when (old.name is distinct from new.name or old.sort_order is distinct from new.sort_order)
  execute function cdrrmo.sync_entry_zones();

create trigger sync_entry_zones after update of zone_id on cdrrmo.barangays
  for each row when (old.zone_id is distinct from new.zone_id)
  execute function cdrrmo.sync_entry_zones();

revoke execute on function cdrrmo.sync_entry_zones() from public, anon, authenticated;

-- Bring rows from earlier renames in line now.
update cdrrmo.report_entries e
set zone_name = z.name, zone_sort = z.sort_order
from cdrrmo.barangays b
join cdrrmo.zones z on z.id = b.zone_id
where e.barangay_id = b.id
  and (e.zone_name, e.zone_sort) is distinct from (z.name, z.sort_order);
