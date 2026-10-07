'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useLiveReport } from '@/hooks/use-live-report';
import { useNewerReport } from '@/hooks/use-newer-report';
import { filterEntries, groupByZone, zoneNames } from '@/lib/filter';
import { formatReportHeading, formatShortHeading } from '@/lib/format';
import { makeOptionLabeler } from '@/lib/labels';
import { summarizeReport } from '@/lib/summary';
import type { ConditionOption, ReportBundle, Settings } from '@/lib/types';
import { BarangayCards } from './barangay-cards';
import { BarangayTable } from './barangay-table';
import { NewReportBanner } from './new-report-banner';
import { ReportBar } from './report-bar';
import { ReportFilters } from './report-filters';
import { ReportFooter } from './report-footer';
import { ReportHeader } from './report-header';
import { ShareButtons } from './share-buttons';
import { SummaryTiles } from './summary-tiles';

const LINK = 'inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline';

export function LiveReportView({ initial, options, settings, isLatest, shareUrl }: {
  initial: ReportBundle;
  options: ConditionOption[];
  settings: Settings;
  isLatest: boolean;
  shareUrl: string;
}) {
  const live = useLiveReport(initial);
  const newer = useNewerReport(live.report.id, live.report.report_at);
  const [zone, setZone] = useState('all');
  const [issuesOnly, setIssuesOnly] = useState(false);

  const summary = useMemo(() => summarizeReport(live.report, live.entries, options), [live.report, live.entries, options]);
  const optionLabel = useMemo(() => makeOptionLabeler(options), [options]);
  const zones = useMemo(() => zoneNames(live.entries), [live.entries]);
  const numbers = useMemo(() => new Map(live.entries.map((e, i) => [e.id, i + 1])), [live.entries]);
  const groups = useMemo(() => groupByZone(filterEntries(live.entries, zone, issuesOnly)), [live.entries, zone, issuesOnly]);

  if (live.deleted) {
    return (
      <>
        <ReportHeader settings={settings} />
        <main id="main" className="mx-auto max-w-xl px-4 py-12 text-center">
          <h1 className="text-xl font-bold">This report was removed</h1>
          <p className="mt-4"><Link href="/" className={LINK}>View the current report</Link></p>
        </main>
      </>
    );
  }

  return (
    <>
      <NewReportBanner newer={newer} onLatestPage={isLatest} />
      <ReportHeader settings={settings} />
      <main id="main" className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <ReportBar
          title={settings.report_title}
          heading={formatReportHeading(live.report.report_at)}
          isLatest={isLatest}
          status={live.status}
          lastUpdated={live.lastUpdated}
        />
        <SummaryTiles summary={summary} />
        <ReportFilters zones={zones} zone={zone} onZoneChange={setZone} issuesOnly={issuesOnly} onIssuesOnlyChange={setIssuesOnly} />
        {groups.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No barangays match this filter.</p>
        ) : (
          <>
            <BarangayCards groups={groups} optionLabel={optionLabel} flashIds={live.flashIds} />
            <BarangayTable groups={groups} optionLabel={optionLabel} flashIds={live.flashIds} numbers={numbers} />
          </>
        )}
        <ReportFooter report={live.report} />
        <section aria-labelledby="share-heading" className="space-y-3">
          <h2 id="share-heading" className="font-bold">Share this report</h2>
          <ShareButtons url={shareUrl} title={`${settings.report_title} – ${formatShortHeading(live.report.report_at)}`} />
        </section>
        <nav aria-label="Reports" className="flex flex-wrap gap-6 border-t pt-4">
          <Link href="/reports" className={LINK}>All reports</Link>
          {!isLatest && <Link href="/" className={LINK}>View latest report</Link>}
          <Link href="/login" className="inline-flex min-h-11 items-center ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline">Staff sign in</Link>
        </nav>
      </main>
    </>
  );
}
