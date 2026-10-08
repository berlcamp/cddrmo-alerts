import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EncoderView } from '@/components/encoder/encoder-view';
import { requireStaff } from '@/lib/auth';
import { getReferenceData } from '@/lib/data/public';
import { fetchReportBundle } from '@/lib/data/report-bundle';
import { isUuid } from '@/lib/ids';
import { reportUrl } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Encode report' };

export default async function EncodeReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  if (!isUuid(id)) notFound();
  const [bundle, { options }] = await Promise.all([fetchReportBundle(await createClient(), id), getReferenceData()]);
  if (!bundle) notFound();
  return <EncoderView initial={bundle} options={options} shareUrl={reportUrl(id)} />;
}
