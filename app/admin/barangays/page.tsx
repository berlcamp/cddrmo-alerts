import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listBarangays, listZones } from '@/lib/data/admin';
import { BarangaysManager } from './barangays-manager';

export const metadata: Metadata = { title: 'Barangays' };

export default async function BarangaysPage() {
  await requireSuperAdmin();
  const [zones, barangays] = await Promise.all([listZones(), listBarangays()]);
  return <BarangaysManager zones={zones} barangays={barangays} />;
}
