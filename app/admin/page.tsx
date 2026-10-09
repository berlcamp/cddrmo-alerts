import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, CalendarX, ChevronRight, FilePenLine, FileText, MapPinned, Phone } from 'lucide-react';
import { StatusBadge } from '@/components/report/status-badge';
import { ABSENCE_THRESHOLD, ABSENCE_WINDOW, addDays, formatShortDay, recurringAbsences } from '@/lib/attendance';
import { requireStaff } from '@/lib/auth';
import { buildDashboard, ISSUE_KINDS, TREND_SIZE } from '@/lib/dashboard';
import { DASHBOARD_WINDOW, getAttendanceWindow, getDashboardData, listBarangays, listOptions } from '@/lib/data/admin';
import { formatShortHeading, manilaDayKey } from '@/lib/format';
import { summaryTone } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { NewReportDialog } from './reports/new-report-dialog';
import { IssueBadge, Panel, ResponseMeter, ResponseTrend, StatTile } from './dashboard-parts';

export const metadata: Metadata = { title: 'Dashboard' };

const linkClass = 'inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-bold text-primary hover:bg-accent';

export default async function AdminDashboardPage() {
  const staff = await requireStaff();
  const today = manilaDayKey(new Date().toISOString());
  const [{ rows, publishedCount, barangayCount }, options, attendanceWindow, barangays] = await Promise.all([
    getDashboardData(),
    listOptions(),
    getAttendanceWindow(addDays(today, -ABSENCE_WINDOW), addDays(today, -1)),
    listBarangays(),
  ]);
  const absences = recurringAbsences(attendanceWindow.operators, attendanceWindow.attendance, today);
  const barangayNames = new Map(barangays.map((b) => [b.id, b.name]));
  const { latest, drafts, publishedInWindow, trend, averageResponse, hotspots } = buildDashboard(rows, options);
  const avgPct = averageResponse === null ? null : Math.round(averageResponse * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Netcall activity at a glance.</p>
        </div>
        <NewReportDialog defaultName={staff.full_name} defaultPosition={staff.position} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={FileText} label="Published reports" value={String(publishedCount)} hint="All time" />
        <StatTile icon={FilePenLine} label="Drafts in progress" value={String(drafts.length)} hint="Not yet public" tone={drafts.length > 0 ? 'warn' : 'none'} />
        <StatTile
          icon={Activity}
          label="Average response"
          value={avgPct === null ? '—' : `${avgPct}%`}
          hint={`Last ${trend.length || TREND_SIZE} published reports`}
          tone={avgPct === null ? 'none' : avgPct >= 75 ? 'ok' : avgPct >= 50 ? 'warn' : 'danger'}
        />
        <StatTile icon={MapPinned} label="Monitored barangays" value={String(barangayCount)} hint="Active stations" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Latest published report"
          className="lg:col-span-2"
          action={latest && <Link href={`/admin/reports/${latest.report.id}`} className={linkClass}>Open <ChevronRight className="size-4" aria-hidden /></Link>}
        >
          {latest ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xl font-bold tabular">{formatShortHeading(latest.report.report_at)}</p>
                {latest.report.prepared_by_name && <p className="text-sm text-muted-foreground">Prepared by {latest.report.prepared_by_name}</p>}
              </div>
              <ResponseMeter active={latest.summary.active} total={latest.summary.total} />
              <ul aria-label="Summary" className="flex flex-wrap gap-2 text-sm font-bold">
                <li className="rounded-full bg-muted px-3 py-1">Weather: {latest.summary.weather}</li>
                <li className="rounded-full bg-muted px-3 py-1">Wind: {latest.summary.wind}</li>
                <li><StatusBadge tone={summaryTone(latest.summary.roads)} label={`Roads: ${latest.summary.roads}`} /></li>
                <li><StatusBadge tone={summaryTone(latest.summary.rivers)} label={`Rivers: ${latest.summary.rivers}`} /></li>
                <li><StatusBadge tone={summaryTone(latest.summary.coastal)} label={`Coastal: ${latest.summary.coastal}`} /></li>
                <li><StatusBadge tone={summaryTone(latest.summary.power)} label={`Power: ${latest.summary.power}`} /></li>
              </ul>
              <div className="space-y-2">
                <h3 className="font-bold">Needs attention <span className="tabular text-muted-foreground">({latest.issues.length})</span></h3>
                {latest.issues.length === 0 ? (
                  <p className="rounded-lg bg-ok-soft px-3 py-2 font-bold text-ok">All stations responded with no alerts.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {latest.issues.map(({ entry, kinds }) => (
                      <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <span className="font-bold">{entry.barangay_name}</span>
                        <span className="text-sm text-muted-foreground">{entry.zone_name} · {entry.callsign}</span>
                        <span className="ml-auto flex flex-wrap gap-1">
                          {kinds.map((k) => <IssueBadge key={k} kind={k} />)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Nothing published yet. Start a report and publish it to see its summary here.</p>
          )}
        </Panel>

        <Panel title="Drafts" action={<Link href="/admin/reports" className={linkClass}>All reports <ChevronRight className="size-4" aria-hidden /></Link>}>
          {drafts.length === 0 ? (
            <p className="text-muted-foreground">No drafts in progress.</p>
          ) : (
            <ul className="-mx-4 -my-4 divide-y">
              {drafts.map(({ report, active, total }) => (
                <li key={report.id}>
                  <Link href={`/admin/reports/${report.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent">
                    <span className="min-w-0">
                      <span className="block font-bold tabular">{formatShortHeading(report.report_at)}</span>
                      <span className="block text-sm tabular text-muted-foreground">{active}/{total} responded</span>
                    </span>
                    <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Response rate" className="lg:col-span-2">
          <p className="mb-3 text-sm text-muted-foreground">Share of stations that answered the roll call, last {trend.length || TREND_SIZE} published reports.</p>
          <ResponseTrend points={trend} />
        </Panel>

        <Panel title="Recurring issues">
          <p className="mb-3 text-sm text-muted-foreground">Barangays most often flagged across the last {publishedInWindow} published reports.</p>
          {hotspots.length === 0 ? (
            <p className="rounded-lg bg-ok-soft px-3 py-2 font-bold text-ok">No issues recorded.</p>
          ) : (
            <ol className="space-y-3">
              {hotspots.map((h) => (
                <li key={h.barangay_id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{h.barangay_name} <span className="text-sm font-normal text-muted-foreground">{h.zone_name}</span></span>
                    <span className="text-sm font-bold tabular text-muted-foreground">{h.reports}/{publishedInWindow}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ISSUE_KINDS.filter((k) => h.counts[k] > 0).map((k) => <IssueBadge key={k} kind={k} count={h.counts[k]} />)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Operators often absent"
          className="lg:col-span-3"
          action={<Link href="/admin/radio-operators/attendance" className={linkClass}>Attendance <ChevronRight className="size-4" aria-hidden /></Link>}
        >
          <div className="mb-4 flex items-center gap-3">
            <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-lg', absences.length > 0 ? 'bg-danger-soft text-danger' : 'bg-ok-soft text-ok')}>
              <CalendarX className="size-5" aria-hidden />
            </span>
            <p className="min-w-0">
              <span className="text-3xl font-bold tabular">{absences.length}</span>
              <span className="ml-2 text-muted-foreground">
                of {attendanceWindow.operators.length} active {attendanceWindow.operators.length === 1 ? 'operator' : 'operators'} missed {ABSENCE_THRESHOLD} or more of the last {ABSENCE_WINDOW} days (today not counted).
              </span>
            </p>
          </div>
          {attendanceWindow.operators.length === 0 ? (
            <p className="text-muted-foreground">No active radio operators yet. <Link href="/admin/radio-operators" className="font-bold text-primary underline-offset-4 hover:underline">Add operators</Link> to track attendance.</p>
          ) : absences.length === 0 ? (
            <p className="rounded-lg bg-ok-soft px-3 py-2 font-bold text-ok">Every active operator reported on most days.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {absences.map(({ operator, missed, tracked, streak, lastPresent }) => (
                <li key={operator.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{operator.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{barangayNames.get(operator.barangay_id) ?? 'Unknown barangay'}{operator.callsign && ` · ${operator.callsign}`}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular text-danger">Missed {missed}/{tracked}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {streak >= 2 && <StatusBadge tone="danger" label={`Absent ${streak} days in a row`} />}
                    <StatusBadge tone="none" label={lastPresent ? `Last present ${formatShortDay(lastPresent)}` : `Not present in ${ABSENCE_WINDOW} days`} />
                  </div>
                  {operator.contact_number && (
                    <a href={`tel:${operator.contact_number.replace(/[^0-9+]/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary tabular underline-offset-4 hover:underline">
                      <Phone className="size-4" aria-hidden /> {operator.contact_number}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">Figures cover the {DASHBOARD_WINDOW} most recent reports unless noted.</p>
    </div>
  );
}
