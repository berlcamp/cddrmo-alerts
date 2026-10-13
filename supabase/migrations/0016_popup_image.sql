-- A pop-up image staff upload from Settings; the public pages open it in a modal shortly after each page load.
alter table cdrrmo.settings
  add column popup_image_url text,
  add column popup_image_alt text not null default '';

-- Pop-up images (posters, advisories) run larger than logos: allow up to 2 MB in the assets bucket.
update storage.buckets set file_size_limit = 2097152 where id = 'cdrrmo-assets';

notify pgrst, 'reload schema';
