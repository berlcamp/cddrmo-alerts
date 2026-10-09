'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { moveWithinGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { zoneSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';

function dbMessage(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'A zone with that name already exists.' : `Could not save: ${error.message}`;
}

function revalidateZones() {
  revalidatePath('/admin/zones');
  revalidatePath('/admin/barangays');
}

export async function saveZone(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const parsed = zoneSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown zone.');
    const { error } = await db.from('zones').update(parsed.data).eq('id', id);
    if (error) return fail(dbMessage(error));
  } else {
    const { data: last } = await db.from('zones').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from('zones').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 });
    if (error) return fail(dbMessage(error));
  }
  revalidateZones();
  return ok(null);
}

export async function moveZone(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('zones').select('id, sort_order');
  if (error) return fail(error.message, true);
  const rows = (data ?? []) as { id: string; sort_order: number }[];
  if (!rows.some((row) => row.id === id)) return fail('Unknown zone.');
  for (const change of moveWithinGroup(rows, id, direction)) {
    const { error: updateError } = await db.from('zones').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidateZones();
  return ok(null);
}
