import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveReportView } from '@/components/report/live-report-view';
import { NoReports } from '@/components/report/no-reports';
import { ReportHeader } from '@/components/report/report-header';
import { getLatestReportMeta, getReferenceData, getReportBundle } from '@/lib/data/public';
import { reportMetadata } from '@/lib/report-metadata';
import { reportUrl } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const latest = await getLatestReportMeta();
  if (!latest) return {};
  const [bundle, { options }] = await Promise.all([getReportBundle(latest.id), getReferenceData()]);
  return bundle ? reportMetadata(bundle, options, { canonicalPath: '/' }) : {};
}

export default async function HomePage() {
  const [latest, reference] = await Promise.all([getLatestReportMeta(), getReferenceData()]);
  if (!latest) {
    return (
      <>
        <ReportHeader settings={reference.settings} />
        <main id="main" className="px-4 py-12"><NoReports /></main>
      </>
    );
  }
  const bundle = await getReportBundle(latest.id);
  if (!bundle) notFound();
  return (
    <LiveReportView
      initial={bundle}
      options={reference.options}
      settings={reference.settings}
      isLatest
      shareUrl={reportUrl(bundle.report.id)}
    />
  );
}
