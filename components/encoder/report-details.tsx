'use client';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/form-field';
import type { ReportSaveStatus } from '@/hooks/use-report-saver';
import { formatReportHeading, fromManilaInputValue, toManilaInputValue } from '@/lib/format';
import type { Report } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';
import { BlurInput } from './blur-input';
import { SaveText } from './save-text';

export function ReportDetails({ report, save, status, onRetry }: { report: Report; save: (patch: ReportPatch) => Promise<void>; status: ReportSaveStatus; onRetry: () => void }) {
  return (
    <section aria-labelledby="details-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="details-heading" className="text-xl font-bold tabular">{formatReportHeading(report.report_at)}</h1>
        <span className="flex items-center gap-2">
          <SaveText status={status} />
          {status === 'error' && <Button type="button" variant="outline" className="h-11 cursor-pointer" onClick={onRetry}>Retry</Button>}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Netcall date and time" htmlFor="report_at">
          <BlurInput
            id="report_at"
            type="datetime-local"
            value={toManilaInputValue(report.report_at)}
            onCommit={(value) => {
              if (value) void save({ report_at: fromManilaInputValue(value) });
            }}
          />
        </FormField>
        <FormField label="Prepared by" htmlFor="prepared_by_name">
          <BlurInput id="prepared_by_name" value={report.prepared_by_name} onCommit={(v) => void save({ prepared_by_name: v })} />
        </FormField>
        <FormField label="Position" htmlFor="prepared_by_position">
          <BlurInput id="prepared_by_position" value={report.prepared_by_position} onCommit={(v) => void save({ prepared_by_position: v })} />
        </FormField>
      </div>
    </section>
  );
}
