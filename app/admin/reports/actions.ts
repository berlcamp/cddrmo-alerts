'use server';

import { redirect } from 'next/navigation';
import { fail, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { fromManilaInputValue } from '@/lib/format';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { newReportSchema } from '@/lib/validation';

export async function createReport(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) return fail('Your session has expired. Sign in again.');
  const parsed = newReportSchema.safeParse({
    report_at_local: formData.get('report_at_local'),
    prepared_by_name: formData.get('prepared_by_name'),
    prepared_by_position: formData.get('prepared_by_position') ?? '',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');

  const { data, error } = await cdrrmo(await createClient()).rpc('create_report', {
    p_report_at: fromManilaInputValue(parsed.data.report_at_local),
    p_prepared_by_name: parsed.data.prepared_by_name,
    p_prepared_by_position: parsed.data.prepared_by_position,
  });
  if (error) return fail(`Could not create the report: ${error.message}`, true);
  redirect(`/admin/reports/${data as string}`);
}
