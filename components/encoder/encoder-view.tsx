'use client';

import { ImageDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { LiveIndicator } from '@/components/report/live-indicator';
import { buttonVariants } from '@/components/ui/button';
import { useEntrySaver } from '@/hooks/use-entry-saver';
import { useReportSaver } from '@/hooks/use-report-saver';
import { useLiveReport } from '@/hooks/use-live-report';
import { updateEntry } from '@/lib/actions/report-actions';
import { cn } from '@/lib/utils';
import { applyPatch } from '@/lib/encoder-patches';
import { formatShortHeading } from '@/lib/format';
import { summarizeReport, type SummaryOverrides } from '@/lib/summary';
import type { ConditionOption, ReportBundle } from '@/lib/types';
import { DeleteReportDialog } from './delete-report-dialog';
import { MissingBarangaysButton } from './missing-barangays-button';
import { PublishBar } from './publish-bar';
import { ReportDetails } from './report-details';
import { ReportRemarks } from './report-remarks';
import { RollCallTable } from './roll-call-table';
import { SharePanel } from './share-panel';
import { SummaryStrip } from './summary-strip';

const NO_OVERRIDES: SummaryOverrides = {
  weather_summary_override: null,
  wind_summary_override: null,
  rivers_summary_override: null,
  roads_summary_override: null,
  coastal_summary_override: null,
};

export function EncoderView({ initial, options, shareUrl }: {
  initial: ReportBundle;
  options: ConditionOption[];
  shareUrl: string;
}) {
  const live = useLiveReport(initial, { staff: true });
  const saver = useEntrySaver(updateEntry, live.applyEntry);
  const reportSaver = useReportSaver(live.report.id, live.applyReport);

  const entries = useMemo(() => live.entries.map((e) => applyPatch(e, saver.pending[e.id])), [live.entries, saver.pending]);
  const summary = useMemo(() => summarizeReport(live.report, entries, options), [live.report, entries, options]);
  const computed = useMemo(() => summarizeReport(NO_OVERRIDES, entries, options), [entries, options]);
  const weatherOptions = useMemo(() => options.filter((o) => o.kind === 'weather' && o.is_active), [options]);
  const windOptions = useMemo(() => options.filter((o) => o.kind === 'wind' && o.is_active), [options]);

  const hasUnsaved = saver.hasUnsaved || reportSaver.hasUnsaved;
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLinks = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (!window.confirm('You have unsaved changes that have not reached the server yet. Leave anyway?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLinks, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guardLinks, true);
    };
  }, [hasUnsaved]);

  if (live.deleted) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="font-bold">This report was deleted.</p>
        <Link href="/admin/reports" className="mt-2 inline-block font-bold text-primary underline-offset-4 hover:underline">Back to reports</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/reports" className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline">← All reports</Link>
        <div className="flex flex-wrap items-center gap-3">
          <LiveIndicator status={live.status} lastUpdated={live.lastUpdated} />
          <a
            href={`/admin/reports/${live.report.id}/export`}
            download
            target="_blank"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11')}
            onClick={(event) => {
              if (hasUnsaved && !window.confirm('Some changes have not been saved yet and will be missing from the image. Export anyway?')) event.preventDefault();
            }}
          >
            <ImageDown aria-hidden /> Export image
          </a>
        </div>
      </div>
      {live.report.status === 'draft' && <PublishBar reportId={live.report.id} hasUnsaved={hasUnsaved} onPublished={live.applyReport} />}
      <ReportDetails report={live.report} save={reportSaver.save} status={reportSaver.status} onRetry={reportSaver.retry} />
      <SummaryStrip summary={summary} />
      <RollCallTable
        entries={entries}
        states={saver.states}
        flashIds={live.flashIds}
        weatherOptions={weatherOptions}
        windOptions={windOptions}
        onPatch={saver.update}
        onRetry={saver.retry}
        onDiscard={saver.discard}
      />
      <MissingBarangaysButton reportId={live.report.id} />
      <ReportRemarks report={live.report} computed={computed} save={reportSaver.save} status={reportSaver.status} />
      {live.report.status === 'published' && <SharePanel url={shareUrl} title={`Barangay Weather SitRep – ${formatShortHeading(live.report.report_at)}`} />}
      <DeleteReportDialog reportId={live.report.id} reportAt={live.report.report_at} />
    </div>
  );
}
