'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { isDayKey } from '@/lib/attendance';
import { getCurrentStaff } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
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
    const { error } = await db.from('radio_operators').insert(parsed.data);
    if (error) return fail(`Could not save: ${error.message}`);
  }
  revalidatePath('/admin/radio-operators', 'layout');
  return ok(null);
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
