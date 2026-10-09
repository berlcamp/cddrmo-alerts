'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { isDayKey } from '@/lib/attendance';
import { getCurrentStaff } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { IMPORT_LIMIT } from '@/lib/operator-import';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { operatorSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';

export async function saveOperator(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const parsed = operatorSchema.safeParse({
    barangay_id: formData.get('barangay_id'),
    name: formData.get('name'),
    callsign: formData.get('callsign') ?? '',
    position: formData.get('position') ?? '',
    contact_number: formData.get('contact_number') ?? '',
    status: formData.get('status'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown radio operator.');
    const { error } = await db.from('radio_operators').update(parsed.data).eq('id', id);
    if (error) return fail(`Could not save: ${error.message}`);
  } else {
    const { data: last } = await db.from('radio_operators').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from('radio_operators').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 });
    if (error) return fail(`Could not save: ${error.message}`);
  }
  revalidatePath('/admin/radio-operators', 'layout');
  return ok(null);
}

/**
 * Adds operators from a CSV import. A row whose barangay and name (ignoring case) match an existing operator
 * updates that operator instead of adding a duplicate. The file's row order becomes the list order; operators
 * not in the file keep their order after the imported ones.
 */
export async function importOperators(rows: unknown[]): Promise<ActionResult<{ added: number; updated: number }>> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if (!Array.isArray(rows) || rows.length === 0) return fail('There are no rows to import.');
  if (rows.length > IMPORT_LIMIT) return fail(`Import at most ${IMPORT_LIMIT} operators at a time.`);
  const parsed = rows.map((row) => operatorSchema.safeParse(row));
  const bad = parsed.findIndex((p) => !p.success);
  if (bad >= 0) return fail(`Row ${bad + 1}: ${parsed[bad].error?.issues[0]?.message ?? 'check the values.'}`);
  const data = parsed.map((p) => p.data!);

  const db = cdrrmo(await createClient());
  const { data: current, error: loadError } = await db.from('radio_operators').select('id, barangay_id, name, sort_order').order('sort_order');
  if (loadError) return fail(`Could not import: ${loadError.message}`, true);
  const rowsNow = (current ?? []) as { id: string; barangay_id: string; name: string; sort_order: number }[];
  const key = (o: { barangay_id: string; name: string }) => `${o.barangay_id}|${o.name.trim().toLowerCase()}`;
  const existing = new Map(rowsNow.map((o) => [key(o), o.id]));

  const positioned = data.map((row, i) => ({ ...row, sort_order: i + 1 }));
  const inserts = positioned.filter((row) => !existing.has(key(row)));
  const updates = positioned.filter((row) => existing.has(key(row)));
  if (inserts.length > 0) {
    const { error } = await db.from('radio_operators').insert(inserts);
    if (error) return fail(`Could not import: ${error.message}`, true);
  }
  for (const row of updates) {
    const { error } = await db.from('radio_operators').update(row).eq('id', existing.get(key(row))!);
    if (error) return fail(`Added ${inserts.length}, but could not update ${row.name}: ${error.message}`, true);
  }
  const imported = new Set(updates.map((row) => existing.get(key(row))));
  const rest = rowsNow.filter((o) => !imported.has(o.id));
  for (const [i, o] of rest.entries()) {
    const sort_order = positioned.length + i + 1;
    if (o.sort_order === sort_order) continue;
    const { error } = await db.from('radio_operators').update({ sort_order }).eq('id', o.id);
    if (error) return fail(`Imported, but could not reorder the remaining operators: ${error.message}`, true);
  }
  revalidatePath('/admin/radio-operators', 'layout');
  revalidatePath('/admin');
  return ok({ added: inserts.length, updated: updates.length });
}

export async function deleteOperator(id: string): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if (!isUuid(id)) return fail('Unknown radio operator.');
  const { error } = await cdrrmo(await createClient()).from('radio_operators').delete().eq('id', id);
  if (error) return fail(`Could not remove: ${error.message}`, true);
  revalidatePath('/admin/radio-operators', 'layout');
  return ok(null);
}

/** Marks an operator present (row exists) or absent (no row) on one day. */
export async function setAttendance(operatorId: string, day: string, present: boolean): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if (!isUuid(operatorId) || !isDayKey(day)) return fail('Unknown operator or day.');
  const db = cdrrmo(await createClient());
  const { error } = present
    ? await db.from('operator_attendance').upsert({ operator_id: operatorId, day }, { onConflict: 'operator_id,day', ignoreDuplicates: true })
    : await db.from('operator_attendance').delete().eq('operator_id', operatorId).eq('day', day);
  if (error) return fail(`Could not save attendance: ${error.message}`, true);
  revalidatePath('/admin/radio-operators/attendance');
  return ok(null);
}
