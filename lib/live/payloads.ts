// isomorphic: validates Realtime broadcast payloads before they reach the live reducer.
import { z } from 'zod';
import type { Report, ReportEntry } from '@/lib/types';
import type { Deleted } from '@/lib/live/report-state';

/** Payloads stamped further than this ahead of the viewer's clock are ignored. */
export const MAX_FUTURE_MS = 5 * 60 * 1000;

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
const id = z.string().min(1);
const level = z.enum(['normal', 'above_normal']).nullable();

const deletedSchema = z.object({ id, deleted: z.literal(true) });

const entrySchema = z.object({
  id,
  report_id: id,
  barangay_id: id,
  barangay_name: z.string(),
  callsign: z.string(),
  zone_name: z.string(),
  zone_sort: z.number(),
  sort_order: z.number(),
  monitors_coastal: z.boolean(),
  responded: z.boolean(),
  weather_option_id: id.nullable(),
  wind_option_id: id.nullable(),
  road: z.enum(['passable', 'unpassable']).nullable(),
  river: level,
  coastal: level,
  power: z.enum(['with_power', 'no_power']).nullable(),
  remarks: z.string().nullable(),
  updated_at: timestamp,
});

const reportSchema = z.object({
  id,
  report_at: timestamp,
  prepared_by_name: z.string(),
  prepared_by_position: z.string(),
  remarks: z.string(),
  weather_summary_override: z.string().nullable(),
  wind_summary_override: z.string().nullable(),
  rivers_summary_override: z.string().nullable(),
  roads_summary_override: z.string().nullable(),
  coastal_summary_override: z.string().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});

const reportsChangedSchema = z.object({
  id,
  report_at: timestamp,
  op: z.enum(['INSERT', 'UPDATE', 'DELETE']),
});
export type ReportsChanged = z.infer<typeof reportsChangedSchema>;

function notInFuture(updatedAt: string, now: number): boolean {
  return Date.parse(updatedAt) <= now + MAX_FUTURE_MS;
}

export function parseEntryPayload(payload: unknown, now = Date.now()): ReportEntry | Deleted | null {
  const deleted = deletedSchema.safeParse(payload);
  if (deleted.success) return deleted.data;
  const entry = entrySchema.safeParse(payload);
  return entry.success && notInFuture(entry.data.updated_at, now) ? entry.data : null;
}

export function parseReportPayload(payload: unknown, now = Date.now()): Report | Deleted | null {
  const deleted = deletedSchema.safeParse(payload);
  if (deleted.success) return deleted.data;
  const report = reportSchema.safeParse(payload);
  return report.success && notInFuture(report.data.updated_at, now) ? report.data : null;
}

export function parseReportsChanged(payload: unknown): ReportsChanged | null {
  const notice = reportsChangedSchema.safeParse(payload);
  return notice.success ? notice.data : null;
}
