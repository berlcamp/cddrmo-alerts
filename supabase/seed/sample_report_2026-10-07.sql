-- The 2026-10-07 1050H netcall from the paper SitRep. Idempotent.
do $$
declare v_report uuid;
begin
  if exists (select 1 from cdrrmo.reports where report_at = '2026-10-07 10:50+08' and prepared_by_name = 'Romeo P. De Los Angeles Jr') then
    return;
  end if;
  insert into cdrrmo.reports (report_at, prepared_by_name, prepared_by_position, remarks)
  values ('2026-10-07 10:50+08', 'Romeo P. De Los Angeles Jr', 'Radio Controller on Duty',
          'All stations reported that their respective AOR are in normal situation.')
  returning id into v_report;

  insert into cdrrmo.report_entries (report_id, barangay_id, barangay_name, callsign, zone_name, zone_sort, sort_order, monitors_coastal)
  select v_report, b.id, b.name, b.callsign, z.name, z.sort_order, b.sort_order, b.monitors_coastal
  from cdrrmo.barangays b join cdrrmo.zones z on z.id = b.zone_id
  where b.is_active;

  update cdrrmo.report_entries e set
    responded = true,
    weather_option_id = (select o.id from cdrrmo.condition_options o where o.kind = 'weather' and o.label = v.weather),
    wind_option_id = (select o.id from cdrrmo.condition_options o where o.kind = 'wind' and o.label = v.wind),
    road = 'passable',
    river = nullif(v.river, ''),
    coastal = nullif(v.coastal, ''),
    power = nullif(v.power, '')
  from (values
    ('Stimson Abordo', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Trigos', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Dalapang', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Cogon', 'Light rain', 'Not windy', '', '', 'with_power'),
    ('Embargo', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Pulot', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Calabayan', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Kinuman Sur', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Sangay Diot', 'Light rain', 'Not windy', 'normal', '', ''),
    ('Balintawak', 'Moderate rain', 'Not windy', '', '', 'with_power'),
    ('Bañadero', 'Light rain', 'Not windy', 'normal', '', 'with_power'),
    ('Aguada', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Dimaluna', 'Moderate rain', 'Not windy', 'normal', '', 'with_power'),
    ('Baybay Triunfo', 'Light rain', 'Not windy', 'normal', 'normal', 'with_power'),
    ('Malaubang', 'Light rain', 'Light wind', 'normal', 'normal', 'with_power')
  ) as v (name, weather, wind, river, coastal, power)
  where e.report_id = v_report and e.barangay_name = v.name;
end $$;

select r.id, count(*) filter (where e.responded) as active, count(*) as total
from cdrrmo.reports r join cdrrmo.report_entries e on e.report_id = r.id
where r.report_at = '2026-10-07 10:50+08' group by r.id;
