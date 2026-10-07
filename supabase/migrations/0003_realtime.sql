-- Public Broadcast of every report / entry change (one message per change, fanned out by Realtime).
create or replace function cdrrmo.broadcast_entry_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'entry', 'cdrrmo:report:' || old.report_id, false);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'entry', 'cdrrmo:report:' || new.report_id, false);
  return new;
end $$;

create trigger broadcast_entry_change
  after insert or update or delete on cdrrmo.report_entries
  for each row execute function cdrrmo.broadcast_entry_change();

create or replace function cdrrmo.broadcast_report_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'report', 'cdrrmo:report:' || old.id, false);
    perform realtime.send(jsonb_build_object('id', old.id, 'report_at', old.report_at, 'op', 'DELETE'), 'reports_changed', 'cdrrmo:reports', false);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'report', 'cdrrmo:report:' || new.id, false);
  if tg_op = 'INSERT' or new.report_at is distinct from old.report_at then
    perform realtime.send(jsonb_build_object('id', new.id, 'report_at', new.report_at, 'op', tg_op), 'reports_changed', 'cdrrmo:reports', false);
  end if;
  return new;
end $$;

create trigger broadcast_report_change
  after insert or update or delete on cdrrmo.reports
  for each row execute function cdrrmo.broadcast_report_change();

revoke execute on function cdrrmo.broadcast_entry_change(), cdrrmo.broadcast_report_change() from public, anon, authenticated;
