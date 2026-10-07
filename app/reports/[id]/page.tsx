import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveReportView } from '@/components/report/live-report-view';
import { getLatestReportMeta, getReferenceData, getReportBundle } from '@/lib/data/public';
import { reportMetadata } from '@/lib/report-metadata';
import { reportUrl } from '@/lib/site';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [bundle, { options }] = await Promise.all([getReportBundle(id), getReferenceData()]);
  if (!bundle) return { title: 'Report not found' };
  return reportMetadata(bundle, options, { canonicalPath: `/reports/${id}` });
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const [bundle, reference, latest] = await Promise.all([getReportBundle(id), getReferenceData(), getLatestReportMeta()]);
  if (!bundle) notFound();
  return (
    <LiveReportView
      initial={bundle}
      options={reference.options}
      settings={reference.settings}
      isLatest={latest?.id === id}
      shareUrl={reportUrl(id)}
    />
  );
}
