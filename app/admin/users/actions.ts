'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getSuperAdminForAction } from '@/lib/auth';
import { isUuid } from '@/lib/ids';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { staffSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Only the super admin can manage users.';

export async function addStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  const parsed = staffSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    position: formData.get('position') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const { error } = await cdrrmo(await createClient())
    .from('users')
    .insert({ ...parsed.data, position: parsed.data.position || 'Radio Controller on Duty', role: 'encoder' });
  if (error) return fail(error.code === '23505' ? 'That email is already on the staff list.' : `Could not add: ${error.message}`);
  revalidatePath('/admin/users');
  return ok(null);
}

export async function setStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  if (!isUuid(id)) return fail('Unknown user.');
  const { error } = await cdrrmo(await createClient()).from('users').update({ is_active: isActive }).eq('id', id);
  if (error) return fail(error.message);
  revalidatePath('/admin/users');
  return ok(null);
}

export async function removeStaff(id: string): Promise<ActionResult> {
  if (!(await getSuperAdminForAction())) return fail(NOT_ALLOWED);
  if (!isUuid(id)) return fail('Unknown user.');
  const { error } = await cdrrmo(await createClient()).from('users').delete().eq('id', id);
  if (error) return fail(error.message);
  revalidatePath('/admin/users');
  return ok(null);
}
