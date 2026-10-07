import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import type { StaffUser } from '@/lib/types';

export const getCurrentStaff = cache(async (): Promise<StaffUser | null> => {
  const supabase = await createClient();
  const { data, error } = await cdrrmo(supabase).rpc('current_staff').maybeSingle();
  if (error || !data) return null;
  return data as StaffUser;
});

export async function requireStaff(): Promise<StaffUser> {
  const staff = await getCurrentStaff();
  if (!staff) redirect('/login');
  return staff;
}

export async function requireSuperAdmin(): Promise<StaffUser> {
  const staff = await requireStaff();
  if (staff.role !== 'super_admin') redirect('/admin/reports');
  return staff;
}
