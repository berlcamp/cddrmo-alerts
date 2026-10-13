-- The calmest weather option reads "Fair" rather than "Sunny", since night reports show it with a moon.
-- Only renames the seeded label; an option already relabelled in Settings is left alone.
update cdrrmo.condition_options set label = 'Fair' where kind = 'weather' and label = 'Sunny';
