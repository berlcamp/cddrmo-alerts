import 'server-only';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { Barangay, ConditionOption, Report, Settings, StaffUser, Zone } from '@/lib/types';

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
