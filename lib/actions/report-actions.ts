'use server';

import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { formatMilitaryTime } from '@/lib/format';
import { isUuid } from '@/lib/ids';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { Report, ReportEntry } from '@/lib/types';
import { entryPatchSchema, reportPatchSchema, type EntryPatch, type ReportPatch } from '@/lib/validation';

const SESSION_EXPIRED = 'Your session has expired. Sign in again in a new tab, then press Retry.';

export async function updateEntry(entryId: string, patch: EntryPatch): Promise<ActionResult<ReportEntry>> {
  const staff = await getCurrentStaff();
  if (!staff) return fail(SESSION_EXPIRED);
  if (!isUuid(entryId)) return fail('Unknown barangay row.');
  const parsed = entryPatchSchema.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid value.');

  const { data, error } = await cdrrmo(await createClient())
    .from('report_entries')
    .update({ ...parsed.data, updated_by: staff.id })
    .eq('id', entryId)
    .select('*')
    .maybeSingle();
  if (error) return fail(`Could not save: ${error.message}`, true);
  if (!data) return fail('This barangay row no longer exists.');
  return ok(data as ReportEntry);
}

export async function updateReport(reportId: string, patch: ReportPatch): Promise<ActionResult<Report>> {
  const staff = await getCurrentStaff();
  if (!staff) return fail(SESSION_EXPIRED);
  if (!isUuid(reportId)) return fail('Unknown report.');
  const parsed = reportPatchSchema.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid value.');

  const { data, error } = await cdrrmo(await createClient())
    .from('reports')
    .update({ ...parsed.data, updated_by: staff.id })
    .eq('id', reportId)
    .select('*')
    .maybeSingle();
  if (error) return fail(`Could not save: ${error.message}`, true);
  if (!data) return fail('This report no longer exists.');
  return ok(data as Report);
}

export async function publishReport(reportId: string): Promise<ActionResult<Report>> {
  const staff = await getCurrentStaff();
  if (!staff) return fail(SESSION_EXPIRED);
  if (!isUuid(reportId)) return fail('Unknown report.');

  const { data, error } = await cdrrmo(await createClient())
    .from('reports')
    .update({ status: 'published', updated_by: staff.id })
    .eq('id', reportId)
    .select('*')
    .maybeSingle();
  if (error) return fail(`Could not publish: ${error.message}`, true);
  if (!data) return fail('This report no longer exists.');
  return ok(data as Report);
}

export async function addMissingBarangays(reportId: string): Promise<ActionResult<number>> {
  if (!(await getCurrentStaff())) return fail(SESSION_EXPIRED);
  if (!isUuid(reportId)) return fail('Unknown report.');
  const { data, error } = await cdrrmo(await createClient()).rpc('add_missing_barangays', { p_report_id: reportId });
  if (error) return fail(`Could not add barangays: ${error.message}`, true);
  return ok(data as number);
}

export async function deleteReport(reportId: string, confirmation: string): Promise<ActionResult> {
  const staff = await getCurrentStaff();
  if (!staff || staff.role !== 'super_admin') return fail('Only the super admin can delete reports.');
  if (!isUuid(reportId)) return fail('Unknown report.');
  const db = cdrrmo(await createClient());
  const { data: report } = await db.from('reports').select('report_at').eq('id', reportId).maybeSingle();
  if (!report) return fail('Report not found.');
  const expected = formatMilitaryTime((report as { report_at: string }).report_at);
  if (confirmation.trim().toUpperCase() !== expected) return fail(`Type ${expected} to confirm.`);
  const { error } = await db.from('reports').delete().eq('id', reportId);
  if (error) return fail(`Could not delete: ${error.message}`, true);
  redirect('/admin/reports');
}
