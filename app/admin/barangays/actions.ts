'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { moveWithinGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { barangaySchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage barangays.';

function dbMessage(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'A barangay with that name already exists.' : `Could not save: ${error.message}`;
}

export async function saveBarangay(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = barangaySchema.safeParse({
    name: formData.get('name'),
    callsign: formData.get('callsign'),
    zone_id: formData.get('zone_id'),
    monitors_coastal: formData.get('monitors_coastal') === 'on',
    is_active: formData.get('is_active') === 'on',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown barangay.');
    const { error } = await db.from('barangays').update(parsed.data).eq('id', id);
    if (error) return fail(dbMessage(error));
  } else {
    const { data: last } = await db.from('barangays').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from('barangays').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 });
    if (error) return fail(dbMessage(error));
  }
  revalidatePath('/admin/barangays');
  return ok(null);
}

export async function moveBarangay(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('barangays').select('id, zone_id, sort_order');
  if (error) return fail(error.message, true);
  const rows = (data ?? []) as { id: string; zone_id: string; sort_order: number }[];
  const current = rows.find((row) => row.id === id);
  if (!current) return fail('Unknown barangay.');
  for (const change of moveWithinGroup(rows.filter((row) => row.zone_id === current.zone_id), id, direction)) {
    const { error: updateError } = await db.from('barangays').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidatePath('/admin/barangays');
  return ok(null);
}
