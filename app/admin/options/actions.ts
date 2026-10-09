'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { reorderGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { optionSchema, zoneSchema } from '@/lib/validation';
import type { ConditionKind } from '@/lib/types';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';
const STALE = 'The list changed in the meantime. Reload the page and try again.';

type Db = ReturnType<typeof cdrrmo>;

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string' && isUuid(id));
}

/** Writes the sort orders that put `rows` in `orderedIds` order. */
async function applyOrder(db: Db, table: 'zones' | 'condition_options', rows: { id: string; sort_order: number }[], orderedIds: string[]): Promise<ActionResult | null> {
  const changes = reorderGroup(rows, orderedIds);
  if (!changes) return fail(STALE);
  for (const change of changes) {
    const { error } = await db.from(table).update({ sort_order: change.sort_order }).eq('id', change.id);
    if (error) return fail(error.message, true);
  }
  return null;
}

export async function saveOption(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const parsed = optionSchema.safeParse({
    kind: formData.get('kind'),
    label: formData.get('label'),
    severity: formData.get('severity'),
    is_active: formData.get('is_active') === 'on',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const db = cdrrmo(await createClient());
  const id = formData.get('id');
  let error: { code?: string; message: string } | null;
  if (typeof id === 'string' && id !== '') {
    if (!isUuid(id)) return fail('Unknown option.');
    ({ error } = await db.from('condition_options').update(parsed.data).eq('id', id));
  } else {
    const { data: last } = await db.from('condition_options').select('sort_order').eq('kind', parsed.data.kind).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    ({ error } = await db.from('condition_options').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1 }));
  }
  if (error) return fail(error.code === '23505' ? 'That label already exists.' : `Could not save: ${error.message}`);
  revalidatePath('/admin/options');
  return ok(null);
}

export async function reorderOptions(kind: ConditionKind, orderedIds: string[]): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if ((kind !== 'weather' && kind !== 'wind') || !isIdList(orderedIds)) return fail('Unknown option.');
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('condition_options').select('id, sort_order').eq('kind', kind);
  if (error) return fail(error.message, true);
  const failed = await applyOrder(db, 'condition_options', (data ?? []) as { id: string; sort_order: number }[], orderedIds);
  if (failed) return failed;
  revalidatePath('/admin/options');
  return ok(null);
}

function zoneMessage(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'A zone with that name already exists.' : `Could not save: ${error.message}`;
}

function revalidateZones() {
  revalidatePath('/admin/options');
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
    if (error) return fail(zoneMessage(error));
  } else {
    const { data: last } = await db.from('zones').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from('zones').insert({ ...parsed.data, sort_order: ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1 });
    if (error) return fail(zoneMessage(error));
  }
  revalidateZones();
  return ok(null);
}

export async function reorderZones(orderedIds: string[]): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  if (!isIdList(orderedIds)) return fail('Unknown zone.');
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('zones').select('id, sort_order');
  if (error) return fail(error.message, true);
  const failed = await applyOrder(db, 'zones', (data ?? []) as { id: string; sort_order: number }[], orderedIds);
  if (failed) return failed;
  revalidateZones();
  return ok(null);
}
