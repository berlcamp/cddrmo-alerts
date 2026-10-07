'use client';

import { FormField } from '@/components/form-field';
import { useReportSaver } from '@/hooks/use-report-saver';
import { formatReportHeading, fromManilaInputValue, toManilaInputValue } from '@/lib/format';
import type { Report } from '@/lib/types';
import { BlurInput } from './blur-input';
import { SaveText } from './save-text';

export function ReportDetails({ report, onSaved }: { report: Report; onSaved: (report: Report) => void }) {
  const { save, status } = useReportSaver(report.id, onSaved);
  return (
    <section aria-labelledby="details-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="details-heading" className="text-xl font-bold tabular">{formatReportHeading(report.report_at)}</h1>
        <SaveText status={status} />
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
