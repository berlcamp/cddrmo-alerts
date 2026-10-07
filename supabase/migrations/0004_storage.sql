insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cdrrmo-assets', 'cdrrmo-assets', true, 512000, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "cdrrmo assets: super admin reads" on storage.objects for select to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
create policy "cdrrmo assets: super admin uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
create policy "cdrrmo assets: super admin deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_super_admin()));
