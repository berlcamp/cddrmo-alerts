-- Radio operators assigned to each barangay, and a per-day attendance log (a row means the operator
-- was present / reported that day). Contact numbers are personal data, so only staff can read these.
create table cdrrmo.radio_operators (
  id uuid primary key default gen_random_uuid(),
  barangay_id uuid not null references cdrrmo.barangays (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  callsign text not null default '' check (char_length(callsign) <= 40),
  position text not null default '' check (char_length(position) <= 120),
  contact_number text not null default '' check (char_length(contact_number) <= 30),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index radio_operators_barangay_id_idx on cdrrmo.radio_operators (barangay_id);
create trigger set_updated_at before update on cdrrmo.radio_operators
  for each row execute function cdrrmo.set_updated_at();

create table cdrrmo.operator_attendance (
  operator_id uuid not null references cdrrmo.radio_operators (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (operator_id, day)
);
create index operator_attendance_day_idx on cdrrmo.operator_attendance (day);

alter table cdrrmo.radio_operators enable row level security;
alter table cdrrmo.operator_attendance enable row level security;

do $$
declare t text;
begin
  foreach t in array array['radio_operators', 'operator_attendance'] loop
    execute format('create policy %s_read on cdrrmo.%I for select to authenticated using ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_staff())) with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_staff()))', t, t);
  end loop;
end $$;

revoke all on cdrrmo.radio_operators, cdrrmo.operator_attendance from anon;
grant select, insert, update, delete on cdrrmo.radio_operators, cdrrmo.operator_attendance to authenticated;

notify pgrst, 'reload schema';
