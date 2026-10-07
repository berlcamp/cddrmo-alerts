'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { moveWithinGroup } from '@/lib/reorder';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { optionSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage options.';

export async function saveOption(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
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

export async function moveOption(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const db = cdrrmo(await createClient());
  const { data, error } = await db.from('condition_options').select('id, kind, sort_order');
  if (error) return fail(error.message, true);
  const rows = (data ?? []) as { id: string; kind: string; sort_order: number }[];
  const current = rows.find((row) => row.id === id);
  if (!current) return fail('Unknown option.');
  for (const change of moveWithinGroup(rows.filter((row) => row.kind === current.kind), id, direction)) {
    const { error: updateError } = await db.from('condition_options').update({ sort_order: change.sort_order }).eq('id', change.id);
    if (updateError) return fail(updateError.message, true);
  }
  revalidatePath('/admin/options');
  return ok(null);
}
