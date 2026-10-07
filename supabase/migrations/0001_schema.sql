-- CDRRMO Barangay Weather SitRep: schema, constraints, triggers, seed data.
create schema if not exists cdrrmo;

create or replace function cdrrmo.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table cdrrmo.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cdrrmo.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  callsign text not null,
  zone_id uuid not null references cdrrmo.zones (id) on delete restrict,
  sort_order int not null default 0,
  monitors_coastal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index barangays_zone_id_idx on cdrrmo.barangays (zone_id);

create table cdrrmo.condition_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('weather', 'wind')),
  label text not null,
  severity int not null default 0,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, label)
);

create table cdrrmo.settings (
  id int primary key default 1 check (id = 1),
  office_title text not null default 'Office of the Mayor',
  office_lines text[] not null default array['City Disaster Risk Reduction and Management Office', 'City of Ozamiz, Misamis Occidental'],
  network_name text not null default 'Nagkahiusang Alerto sa Ozamiz Radio Communication Network',
  call_sign text not null default 'Rescue Base',
  radio_frequency text not null default '148.710',
  report_title text not null default 'Barangay Weather SitRep',
  logo_urls text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table cdrrmo.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null default '',
  position text not null default 'Radio Controller on Duty',
  role text not null default 'encoder' check (role in ('super_admin', 'encoder')),
  is_active boolean not null default true,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint only_owner_is_super_admin check (role <> 'super_admin' or email = 'berlcamp@gmail.com')
);

create table cdrrmo.reports (
  id uuid primary key default gen_random_uuid(),
  report_at timestamptz not null,
  prepared_by_name text not null default '',
  prepared_by_position text not null default 'Radio Controller on Duty',
  remarks text not null default '',
  weather_summary_override text,
  wind_summary_override text,
  rivers_summary_override text,
  roads_summary_override text,
  coastal_summary_override text,
  created_by uuid references cdrrmo.users (id) on delete set null,
  updated_by uuid references cdrrmo.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_report_at_idx on cdrrmo.reports (report_at desc);
create index reports_created_by_idx on cdrrmo.reports (created_by);
create index reports_updated_by_idx on cdrrmo.reports (updated_by);

create table cdrrmo.report_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references cdrrmo.reports (id) on delete cascade,
  barangay_id uuid not null references cdrrmo.barangays (id) on delete restrict,
  barangay_name text not null,
  callsign text not null,
  zone_name text not null,
  zone_sort int not null,
  sort_order int not null,
  monitors_coastal boolean not null,
  responded boolean not null default false,
  weather_option_id uuid references cdrrmo.condition_options (id) on delete set null,
  wind_option_id uuid references cdrrmo.condition_options (id) on delete set null,
  road text check (road in ('passable', 'unpassable')),
  river text check (river in ('normal', 'above_normal')),
  coastal text check (coastal in ('normal', 'above_normal')),
  power text check (power in ('with_power', 'no_power')),
  remarks text,
  updated_by uuid references cdrrmo.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, barangay_id)
);
create index report_entries_barangay_id_idx on cdrrmo.report_entries (barangay_id);
create index report_entries_weather_idx on cdrrmo.report_entries (weather_option_id);
create index report_entries_wind_idx on cdrrmo.report_entries (wind_option_id);
create index report_entries_updated_by_idx on cdrrmo.report_entries (updated_by);

-- updated_at on every table
do $$
declare t text;
begin
  foreach t in array array['zones', 'barangays', 'condition_options', 'settings', 'users', 'reports', 'report_entries'] loop
    execute format('create trigger set_updated_at before update on cdrrmo.%I for each row execute function cdrrmo.set_updated_at()', t);
  end loop;
end $$;

-- "No response" rows never keep condition values; coastal only where monitored.
create or replace function cdrrmo.clear_unresponded_entry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.responded then
    new.weather_option_id := null;
    new.wind_option_id := null;
    new.road := null;
    new.river := null;
    new.coastal := null;
    new.power := null;
  end if;
  if not new.monitors_coastal then
    new.coastal := null;
  end if;
  return new;
end $$;
create trigger clear_unresponded before insert or update on cdrrmo.report_entries
  for each row execute function cdrrmo.clear_unresponded_entry();

-- The owner account can never be demoted, deactivated, renamed or deleted.
create or replace function cdrrmo.protect_super_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.email = 'berlcamp@gmail.com' then
      raise exception 'The super admin account cannot be removed';
    end if;
    return old;
  end if;
  if old.email = 'berlcamp@gmail.com'
     and (new.email <> old.email or new.role <> 'super_admin' or not new.is_active) then
    raise exception 'The super admin account cannot be demoted, deactivated or renamed';
  end if;
  return new;
end $$;
create trigger protect_super_admin before update or delete on cdrrmo.users
  for each row execute function cdrrmo.protect_super_admin();

-- Seed data
insert into cdrrmo.zones (name, sort_order) values
  ('Upland', 1), ('Midland', 2), ('Lowland', 3), ('Coastal', 4);

insert into cdrrmo.barangays (name, callsign, zone_id, sort_order, monitors_coastal)
select v.name, v.callsign, z.id, v.sort_order, v.monitors_coastal
from (values
  ('Stimson Abordo', 'Sierra 5', 'Upland', 1, false),
  ('Gala', 'Golf 2', 'Upland', 2, false),
  ('Guimad', 'Golf 5', 'Upland', 3, false),
  ('Trigos', 'Tango 3', 'Upland', 4, false),
  ('Dalapang', 'Delta 1', 'Upland', 5, false),
  ('Cogon', 'Charlie 8', 'Upland', 6, false),
  ('Embargo', 'Eagle', 'Midland', 7, false),
  ('Pantaon', 'Papa 1', 'Midland', 8, false),
  ('Pulot', 'Papa 2', 'Midland', 9, false),
  ('Calabayan', 'Charlie 1', 'Midland', 10, false),
  ('Kinuman Sur', 'Kilo 2', 'Midland', 11, false),
  ('Sangay Diot', 'Sierra 1', 'Midland', 12, false),
  ('Cavinte', 'Charlie 7', 'Midland', 13, false),
  ('Balintawak', 'Bravo 3', 'Lowland', 14, false),
  ('Bañadero', 'Bravo 4', 'Lowland', 15, false),
  ('Aguada', 'Alpha', 'Lowland', 16, false),
  ('Dimaluna', 'Delta 3', 'Lowland', 17, false),
  ('Lam-an', 'Lima 3', 'Lowland', 18, false),
  ('Tabid', 'Tango 1', 'Lowland', 19, false),
  ('Bongbong', 'Bravo 8', 'Lowland', 20, false),
  ('Baybay Triunfo', 'Bravo 7', 'Coastal', 21, true),
  ('Malaubang', 'Mike 1', 'Coastal', 22, true),
  ('Catadman-Manabay', 'Charlie 6', 'Coastal', 23, true),
  ('San Antonio', 'Sierra 3', 'Coastal', 24, true)
) as v (name, callsign, zone, sort_order, monitors_coastal)
join cdrrmo.zones z on z.name = v.zone;

insert into cdrrmo.condition_options (kind, label, severity, sort_order) values
  ('weather', 'Sunny', 0, 0),
  ('weather', 'Cloudy', 1, 1),
  ('weather', 'Light rain', 2, 2),
  ('weather', 'Moderate rain', 3, 3),
  ('weather', 'Heavy rain', 4, 4),
  ('weather', 'Torrential rain', 5, 5),
  ('wind', 'Not windy', 0, 0),
  ('wind', 'Light wind', 1, 1),
  ('wind', 'Moderate wind', 2, 2),
  ('wind', 'Strong wind', 3, 3);

insert into cdrrmo.settings (id) values (1);

insert into cdrrmo.users (email, full_name, position, role)
values ('berlcamp@gmail.com', 'Super Admin', 'CDRRMO Administrator', 'super_admin');
