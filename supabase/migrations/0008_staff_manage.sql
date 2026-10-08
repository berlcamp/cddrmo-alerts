-- Every active staff member (not only the super admin) manages barangays, options, settings and logos,
-- and may delete reports. Managing users stays super-admin only.

do $$
declare t text;
begin
  foreach t in array array['zones', 'barangays', 'condition_options', 'settings'] loop
    execute format('drop policy %s_insert on cdrrmo.%I', t, t);
    execute format('drop policy %s_update on cdrrmo.%I', t, t);
    execute format('drop policy %s_delete on cdrrmo.%I', t, t);
    execute format('create policy %s_insert on cdrrmo.%I for insert to authenticated with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_update on cdrrmo.%I for update to authenticated using ((select cdrrmo.is_staff())) with check ((select cdrrmo.is_staff()))', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_staff()))', t, t);
  end loop;
  foreach t in array array['reports', 'report_entries'] loop
    execute format('drop policy %s_delete on cdrrmo.%I', t, t);
    execute format('create policy %s_delete on cdrrmo.%I for delete to authenticated using ((select cdrrmo.is_staff()))', t, t);
  end loop;
end $$;

drop policy "cdrrmo assets: super admin reads" on storage.objects;
drop policy "cdrrmo assets: super admin uploads" on storage.objects;
drop policy "cdrrmo assets: super admin deletes" on storage.objects;
create policy "cdrrmo assets: staff reads" on storage.objects for select to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_staff()));
create policy "cdrrmo assets: staff uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_staff()));
create policy "cdrrmo assets: staff deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'cdrrmo-assets' and (select cdrrmo.is_staff()));
