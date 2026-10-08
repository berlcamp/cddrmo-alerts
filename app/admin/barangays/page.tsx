import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { listBarangays, listZones } from '@/lib/data/admin';
import { BarangaysManager } from './barangays-manager';

export const metadata: Metadata = { title: 'Barangays' };

export default async function BarangaysPage() {
  await requireStaff();
  const [zones, barangays] = await Promise.all([listZones(), listBarangays()]);
  return <BarangaysManager zones={zones} barangays={barangays} />;
}
