import 'server-only';
import { connection } from 'next/server';
import { cache } from 'react';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { isUuid } from '@/lib/ids';
import { DEFAULT_SETTINGS } from '@/lib/settings-defaults';
import { summarizeReport } from '@/lib/summary';
import { cdrrmo } from '@/lib/supabase/db';
import { getPublicClient } from '@/lib/supabase/public';
import type { ConditionOption, Report, ReportEntry, ReportSummary, Settings } from '@/lib/types';

export const ARCHIVE_PAGE_SIZE = 50;

export const getReportBundle = cache(async (id: string) => {
  await connection();
  if (!isUuid(id)) return null;
  const bundle = await fetchReportBundle(getPublicClient(), id);
  return bundle?.report.status === 'published' ? bundle : null;
});

export const getLatestReportMeta = cache(async (): Promise<{ id: string; report_at: string } | null> => {
  await connection();
  const { data, error } = await cdrrmo(getPublicClient())
    .from('reports')
    .select('id, report_at')
    .eq('status', 'published')
    .order('report_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the latest report: ${error.message}`);
  return data as { id: string; report_at: string } | null;
});

export const getReferenceData = cache(async (): Promise<{ options: ConditionOption[]; settings: Settings }> => {
  await connection();
  const db = cdrrmo(getPublicClient());
  const [optionsRes, settingsRes] = await Promise.all([
    db.from('condition_options').select('*').order('kind').order('sort_order'),
    db.from('settings').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (optionsRes.error) throw new Error(`Could not load options: ${optionsRes.error.message}`);
  if (settingsRes.error) throw new Error(`Could not load settings: ${settingsRes.error.message}`);
  return {
    options: (optionsRes.data ?? []) as ConditionOption[],
    settings: { ...DEFAULT_SETTINGS, ...((settingsRes.data as Settings | null) ?? {}) },
  };
});

export async function getArchivePage(page: number): Promise<{ items: { report: Report; summary: ReportSummary }[]; hasMore: boolean }> {
  await connection();
  const from = (page - 1) * ARCHIVE_PAGE_SIZE;
  const [{ data, error }, { options }] = await Promise.all([
    cdrrmo(getPublicClient())
      .from('reports')
      .select('*, report_entries(*)')
      .eq('status', 'published')
      .order('report_at', { ascending: false })
      .range(from, from + ARCHIVE_PAGE_SIZE),
    getReferenceData(),
  ]);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  const rows = (data ?? []) as (Report & { report_entries: ReportEntry[] })[];
  const items = rows.slice(0, ARCHIVE_PAGE_SIZE).map(({ report_entries, ...report }) => ({
    report,
    summary: summarizeReport(report, report_entries, options),
  }));
  return { items, hasMore: rows.length > ARCHIVE_PAGE_SIZE };
}
