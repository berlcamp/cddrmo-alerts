import type { Report } from '@/lib/types';

export function ReportFooter({ report }: { report: Report }) {
  return (
    <section aria-label="Remarks and preparer" className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Remarks</h2>
        <p className="mt-1 whitespace-pre-line">{report.remarks || '—'}</p>
      </div>
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Prepared by</h2>
        <p className="mt-1 font-bold uppercase">{report.prepared_by_name || '—'}</p>
        <p className="text-sm text-muted-foreground">{report.prepared_by_position}</p>
      </div>
    </section>
  );
}
