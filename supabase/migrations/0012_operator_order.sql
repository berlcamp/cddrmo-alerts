-- Radio operators keep an explicit list order: the row order of the last CSV import, with operators added by
-- hand going to the end. Existing rows start in roll-call order (zone, barangay, name).
alter table cdrrmo.radio_operators add column sort_order int not null default 0;

update cdrrmo.radio_operators o
set sort_order = ranked.position
from (
  select o2.id, row_number() over (order by z.sort_order, b.sort_order, lower(o2.name)) as position
  from cdrrmo.radio_operators o2
  join cdrrmo.barangays b on b.id = o2.barangay_id
  join cdrrmo.zones z on z.id = b.zone_id
) ranked
where ranked.id = o.id;

create index radio_operators_sort_order_idx on cdrrmo.radio_operators (sort_order);

notify pgrst, 'reload schema';
