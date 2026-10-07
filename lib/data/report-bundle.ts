// isomorphic (server + browser)
import type { SupabaseClient } from '@supabase/supabase-js';
import { cdrrmo } from '@/lib/supabase/db';
import type { Report, ReportBundle, ReportEntry } from '@/lib/types';

export async function fetchReportBundle(client: SupabaseClient, id: string): Promise<ReportBundle | null> {
  const db = cdrrmo(client);
  const [reportRes, entriesRes] = await Promise.all([
    db.from('reports').select('*').eq('id', id).maybeSingle(),
    db.from('report_entries').select('*').eq('report_id', id).order('zone_sort').order('sort_order'),
  ]);
  if (reportRes.error) throw new Error(`Could not load the report: ${reportRes.error.message}`);
  if (entriesRes.error) throw new Error(`Could not load the barangay rows: ${entriesRes.error.message}`);
  if (!reportRes.data) return null;
  return { report: reportRes.data as Report, entries: (entriesRes.data ?? []) as ReportEntry[] };
}
