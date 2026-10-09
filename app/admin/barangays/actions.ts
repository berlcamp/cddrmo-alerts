'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { reorderGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { barangaySchema } from '@/lib/validation';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';

function dbMessage(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'A barangay with that name already exists.' : `Could not save: ${error.message}`;
}

export async function saveBarangay(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const parsed = barangaySchema.safeParse({
    name: formData.get('name'),
    callsign: formData.get('callsign'),
    zone_id: formData.get('zone_id'),
    monitors_coastal: formData.get('monitors_coastal') === 'on',
    no_radio: formData.get('no_radio') === 'on',
    is_active: formData.get('is_active') === 'on',
    latitude: formData.get('latitude') ?? '',
    longitude: formData.get('longitude') ?? '',
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

export async function reorderBarangays(zoneId: string, orderedIds: string[]): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if (typeof zoneId !== 'string' || !isUuid(zoneId) || !Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string' && isUuid(id))) return fail('Unknown barangay.');
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('barangays').select('id, sort_order').eq('zone_id', zoneId);
  if (error) return fail(error.message, true);
  const changes = reorderGroup((data ?? []) as { id: string; sort_order: number }[], orderedIds);
  if (!changes) return fail('The list changed in the meantime. Reload the page and try again.');
  for (const change of changes) {
    const { error: updateError } = await db.from('barangays').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidatePath('/admin/barangays');
  return ok(null);
}
