import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ReportHeader } from '@/components/report/report-header';
import { StatusBadge } from '@/components/report/status-badge';
import { groupArchiveByDay } from '@/lib/archive';
import { getArchivePage, getReferenceData } from '@/lib/data/public';
import { formatDayHeading, formatMilitaryTime } from '@/lib/format';

export const metadata: Metadata = {
  title: 'All reports',
  description: 'Archive of Barangay Weather SitReps from the Ozamiz City CDRRMO netcall.',
};

const LINK = 'inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline';

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const [{ items, hasMore }, { settings }] = await Promise.all([getArchivePage(page), getReferenceData()]);
  const days = groupArchiveByDay(items);

  return (
    <>
      <ReportHeader settings={settings} />
      <main id="main" className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">All reports</h1>
          <Link href="/" className={LINK}>Current report</Link>
        </div>
        {days.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No reports yet.</p>}
        {days.map((day) => (
          <section key={day.day} aria-labelledby={`day-${day.day}`}>
            <h2 id={`day-${day.day}`} className="mb-3 text-lg font-bold">{formatDayHeading(day.day)}</h2>
            <ul className="space-y-2">
              {day.items.map(({ report, summary }) => (
                <li key={report.id}>
                  <Link
                    href={`/reports/${report.id}`}
                    className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary"
                  >
                    <span className="text-xl font-bold tabular">{formatMilitaryTime(report.report_at)}</span>
                    <span className="tabular">{summary.active}/{summary.total} active</span>
                    {summary.noResponse > 0 && <StatusBadge tone="danger" label={`${summary.noResponse} no response`} />}
                    <span className="text-muted-foreground">{summary.weather}</span>
                    {summary.hasIssues && <StatusBadge tone="warn" label="Has issues" />}
                    <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <nav aria-label="Pagination" className="flex justify-between">
          {page > 1 ? <Link href={`/reports?page=${page - 1}`} className={LINK}>← Newer</Link> : <span />}
          {hasMore && <Link href={`/reports?page=${page + 1}`} className={LINK}>Older →</Link>}
        </nav>
      </main>
    </>
  );
}
