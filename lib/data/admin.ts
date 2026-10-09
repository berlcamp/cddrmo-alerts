import 'server-only';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { Barangay, ConditionOption, RadioOperator, Report, ReportEntry, Settings, StaffUser, Zone } from '@/lib/types';

async function db() {
  return cdrrmo(await createClient());
}

export async function listRecentReports(limit = 50): Promise<{ report: Report; active: number; total: number }[]> {
  const { data, error } = await (await db())
    .from('reports')
    .select('*, report_entries(responded)')
    .order('report_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return ((data ?? []) as (Report & { report_entries: { responded: boolean }[] })[]).map(({ report_entries, ...report }) => ({
    report,
    active: report_entries.filter((e) => e.responded).length,
    total: report_entries.length,
  }));
}

export async function listStaff(): Promise<StaffUser[]> {
  const { data, error } = await (await db()).from('users').select('*').order('role', { ascending: false }).order('email');
  if (error) throw new Error(`Could not load users: ${error.message}`);
  return (data ?? []) as StaffUser[];
}

export async function listZones(): Promise<Zone[]> {
  const { data, error } = await (await db()).from('zones').select('id, name, sort_order').order('sort_order');
  if (error) throw new Error(`Could not load zones: ${error.message}`);
  return (data ?? []) as Zone[];
}

export async function listBarangays(): Promise<Barangay[]> {
  const { data, error } = await (await db()).from('barangays').select('*').order('sort_order');
  if (error) throw new Error(`Could not load barangays: ${error.message}`);
  return (data ?? []) as Barangay[];
}

export async function listRadioOperators(): Promise<RadioOperator[]> {
  const { data, error } = await (await db())
    .from('radio_operators')
    .select('id, barangay_id, name, callsign, position, contact_number, status, sort_order')
    .order('sort_order')
    .order('name');
  if (error) throw new Error(`Could not load radio operators: ${error.message}`);
  return (data ?? []) as RadioOperator[];
}

/** Days (YYYY-MM-DD) each operator was marked present in the given YYYY-MM month. */
export async function listAttendance(month: string, lastDay: string): Promise<{ operator_id: string; day: string }[]> {
  const { data, error } = await (await db())
    .from('operator_attendance')
    .select('operator_id, day')
    .gte('day', `${month}-01`)
    .lte('day', lastDay);
  if (error) throw new Error(`Could not load attendance: ${error.message}`);
  return (data ?? []) as { operator_id: string; day: string }[];
}

/** Active operators (with when they were added) and their attendance between two days, inclusive. */
export async function getAttendanceWindow(from: string, to: string): Promise<{
  operators: (RadioOperator & { created_at: string })[];
  attendance: { operator_id: string; day: string }[];
}> {
  const client = await db();
  const [operatorsRes, attendanceRes] = await Promise.all([
    client.from('radio_operators').select('id, barangay_id, name, callsign, position, contact_number, status, sort_order, created_at').eq('status', 'active'),
    client.from('operator_attendance').select('operator_id, day').gte('day', from).lte('day', to),
  ]);
  if (operatorsRes.error) throw new Error(`Could not load radio operators: ${operatorsRes.error.message}`);
  if (attendanceRes.error) throw new Error(`Could not load attendance: ${attendanceRes.error.message}`);
  return {
    operators: (operatorsRes.data ?? []) as (RadioOperator & { created_at: string })[],
    attendance: (attendanceRes.data ?? []) as { operator_id: string; day: string }[],
  };
}

export async function listOptions(): Promise<ConditionOption[]> {
  const { data, error } = await (await db()).from('condition_options').select('*').order('kind').order('sort_order');
  if (error) throw new Error(`Could not load options: ${error.message}`);
  return (data ?? []) as ConditionOption[];
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await (await db()).from('settings').select('*').eq('id', 1).single();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return data as Settings;
}

export const DASHBOARD_WINDOW = 30;

/** The newest reports with their rows, plus whole-table counts, for the admin dashboard. */
export async function getDashboardData(): Promise<{
  rows: { report: Report; entries: ReportEntry[] }[];
  publishedCount: number;
  barangayCount: number;
}> {
  const client = await db();
  const [reportsRes, publishedRes, barangaysRes] = await Promise.all([
    client.from('reports').select('*, report_entries(*)').order('report_at', { ascending: false }).limit(DASHBOARD_WINDOW),
    client.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    client.from('barangays').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);
  if (reportsRes.error) throw new Error(`Could not load reports: ${reportsRes.error.message}`);
  if (publishedRes.error) throw new Error(`Could not count reports: ${publishedRes.error.message}`);
  if (barangaysRes.error) throw new Error(`Could not count barangays: ${barangaysRes.error.message}`);
  const rows = ((reportsRes.data ?? []) as (Report & { report_entries: ReportEntry[] })[]).map(({ report_entries, ...report }) => ({
    report,
    entries: [...report_entries].sort((a, b) => a.zone_sort - b.zone_sort || a.sort_order - b.sort_order),
  }));
  return { rows, publishedCount: publishedRes.count ?? 0, barangayCount: barangaysRes.count ?? 0 };
}
