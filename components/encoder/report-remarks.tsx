'use client';

import { FormField } from '@/components/form-field';
import { useReportSaver } from '@/hooks/use-report-saver';
import type { Report, ReportSummary } from '@/lib/types';
import type { ReportPatch } from '@/lib/validation';
import { BlurInput, BlurTextarea } from './blur-input';
import { SaveText } from './save-text';

type OverrideField = 'weather_summary_override' | 'wind_summary_override' | 'rivers_summary_override' | 'roads_summary_override' | 'coastal_summary_override';

export function ReportRemarks({ report, computed, onSaved }: { report: Report; computed: ReportSummary; onSaved: (report: Report) => void }) {
  const { save, status } = useReportSaver(report.id, onSaved);
  const overrides: [OverrideField, string, string][] = [
    ['weather_summary_override', 'Average weather', computed.weather],
    ['wind_summary_override', 'Average wind', computed.wind],
    ['rivers_summary_override', 'Rivers / canals', computed.rivers],
    ['roads_summary_override', 'Roads / bridges', computed.roads],
    ['coastal_summary_override', 'Coastal', computed.coastal],
  ];
  return (
    <section aria-labelledby="remarks-heading" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="remarks-heading" className="text-lg font-bold">Remarks and summary</h2>
        <SaveText status={status} />
      </div>
      <FormField label="General remarks" htmlFor="remarks" hint="Shown under the barangay list on the public page.">
        <BlurTextarea id="remarks" rows={3} value={report.remarks} onCommit={(v) => void save({ remarks: v })} />
      </FormField>
      <details className="rounded-lg border p-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">Override summary values (optional)</summary>
        <p className="mb-3 text-sm text-muted-foreground">Leave a field blank to use the computed value shown in grey.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {overrides.map(([field, label, placeholder]) => (
            <FormField key={field} label={label} htmlFor={field}>
              <BlurInput
                id={field}
                value={report[field]}
                placeholder={placeholder}
                onCommit={(v) => void save({ [field]: v.trim() === '' ? null : v } as ReportPatch)}
              />
            </FormField>
          ))}
        </div>
      </details>
    </section>
  );
}
