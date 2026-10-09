import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { listBarangays, listZones } from '@/lib/data/admin';
import { ZonesManager } from './zones-manager';

export const metadata: Metadata = { title: 'Zones' };

export default async function ZonesPage() {
  await requireStaff();
  const [zones, barangays] = await Promise.all([listZones(), listBarangays()]);
  const barangayCounts: Record<string, number> = {};
  for (const b of barangays) barangayCounts[b.zone_id] = (barangayCounts[b.zone_id] ?? 0) + 1;
  return <ZonesManager zones={zones} barangayCounts={barangayCounts} />;
}
