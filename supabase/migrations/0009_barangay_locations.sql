-- Map positions for the public barangay map (WGS84). Seeded from OpenStreetMap place points (ODbL);
-- staff can correct them in Admin → Barangays.
alter table cdrrmo.barangays
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add constraint barangays_location_pair check ((latitude is null) = (longitude is null));

update cdrrmo.barangays b
   set latitude = v.lat, longitude = v.lng
  from (values
  ('Stimson Abordo', 8.196690, 123.725381),
  ('Gala', 8.155822, 123.718350),
  ('Guimad', 8.175211, 123.729722),
  ('Trigos', 8.186130, 123.719071),
  ('Dalapang', 8.176085, 123.760912),
  ('Cogon', 8.148444, 123.793740),
  ('Embargo', 8.183765, 123.818358),
  ('Pantaon', 8.165168, 123.785512),
  ('Pulot', 8.128110, 123.810586),
  ('Calabayan', 8.166096, 123.808460),
  ('Kinuman Sur', 8.153732, 123.760017),
  ('Sangay Diot', 8.196557, 123.794995),
  ('Cavinte', 8.144998, 123.754687),
  ('Balintawak', 8.137083, 123.779233),
  ('Bañadero', 8.149770, 123.826865),
  ('Aguada', 8.152243, 123.844707),
  ('Dimaluna', 8.120829, 123.800761),
  ('Lam-an', 8.148954, 123.836393),
  ('Tabid', 8.106825, 123.781151),
  ('Bongbong', 8.133990, 123.815899),
  ('Baybay Triunfo', 8.141371, 123.845009),
  ('Malaubang', 8.135585, 123.829788),
  ('Catadman-Manabay', 8.151568, 123.853168),
  ('San Antonio', 8.177666, 123.867505)
  ) as v (name, lat, lng)
 where b.name = v.name and b.latitude is null;

notify pgrst, 'reload schema';
