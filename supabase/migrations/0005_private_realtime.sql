-- Private Broadcast: only database triggers can send on cdrrmo:* topics; clients can only listen.
-- Replaces the public channels from 0003 (public channels accept client sends with the anon key).

create or replace function cdrrmo.broadcast_entry_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'entry', 'cdrrmo:report:' || old.report_id, true);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'entry', 'cdrrmo:report:' || new.report_id, true);
  return new;
end $$;

create or replace function cdrrmo.broadcast_report_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform realtime.send(jsonb_build_object('id', old.id, 'deleted', true), 'report', 'cdrrmo:report:' || old.id, true);
    perform realtime.send(jsonb_build_object('id', old.id, 'report_at', old.report_at, 'op', 'DELETE'), 'reports_changed', 'cdrrmo:reports', true);
    return old;
  end if;
  perform realtime.send(to_jsonb(new), 'report', 'cdrrmo:report:' || new.id, true);
  if tg_op = 'INSERT' or new.report_at is distinct from old.report_at then
    perform realtime.send(jsonb_build_object('id', new.id, 'report_at', new.report_at, 'op', tg_op), 'reports_changed', 'cdrrmo:reports', true);
  end if;
  return new;
end $$;

revoke execute on function cdrrmo.broadcast_entry_change(), cdrrmo.broadcast_report_change() from public, anon, authenticated;

-- Read-only: anyone may receive cdrrmo broadcasts. There is deliberately no insert/update policy,
-- so no client (anon or signed in) can send on these topics.
drop policy if exists "cdrrmo broadcast read" on realtime.messages;
create policy "cdrrmo broadcast read" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() like 'cdrrmo:%' and extension = 'broadcast');
