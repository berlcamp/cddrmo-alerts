import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { listRecentReports } from '@/lib/data/admin';
import { formatShortHeading } from '@/lib/format';
import { NewReportDialog } from './new-report-dialog';

export const metadata: Metadata = { title: 'Reports' };

export default async function AdminReportsPage() {
  const staff = await requireStaff();
  const reports = await listRecentReports();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Netcall reports</h1>
        <NewReportDialog defaultName={staff.full_name} defaultPosition={staff.position} />
      </div>
      {reports.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No reports yet. Start the first netcall report.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {reports.map(({ report, active, total }) => (
            <li key={report.id}>
              <Link href={`/admin/reports/${report.id}`} className="flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent">
                <span className="font-bold tabular">{formatShortHeading(report.report_at)}</span>
                <span className="tabular text-muted-foreground">{active}/{total} responded</span>
                <span className="hidden text-muted-foreground sm:inline">{report.prepared_by_name}</span>
                <ChevronRight className="ml-auto size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
