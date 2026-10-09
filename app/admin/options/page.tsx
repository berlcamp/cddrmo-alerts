import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { listBarangays, listOptions, listZones } from '@/lib/data/admin';
import { OptionsManager, type OptionsTab } from './options-manager';

export const metadata: Metadata = { title: 'Options' };

const TABS: OptionsTab[] = ['zones', 'weather', 'wind'];

export default async function OptionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff();
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t === requested) ?? 'zones';
  const [zones, barangays, options] = await Promise.all([listZones(), listBarangays(), listOptions()]);
  const barangayCounts: Record<string, number> = {};
  for (const b of barangays) barangayCounts[b.zone_id] = (barangayCounts[b.zone_id] ?? 0) + 1;
  return <OptionsManager tab={tab} zones={zones} barangayCounts={barangayCounts} options={options} />;
}
