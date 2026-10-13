-- A weather advisory staff post from Options › Weather; the public pages show it under the header while it is set.
alter table cdrrmo.settings
  add column weather_advisory text not null default '',
  add column weather_advisory_updated_at timestamptz;

notify pgrst, 'reload schema';
