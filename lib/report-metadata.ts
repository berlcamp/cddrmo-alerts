import type { Metadata } from 'next';
import { formatShortHeading } from '@/lib/format';
import { lastUpdatedAt } from '@/lib/live/report-state';
import { describeSummary, summarizeReport } from '@/lib/summary';
import type { ConditionOption, ReportBundle } from '@/lib/types';

export function reportMetadata(bundle: ReportBundle, options: ConditionOption[], { canonicalPath }: { canonicalPath: string }): Metadata {
  const summary = summarizeReport(bundle.report, bundle.entries, options);
  const title = `Barangay Weather SitRep – ${formatShortHeading(bundle.report.report_at)}`;
  const description = describeSummary(summary);
  const version = Date.parse(lastUpdatedAt(bundle));
  const image = `/reports/${bundle.report.id}/og?v=${version}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: `${title}. ${description}` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
