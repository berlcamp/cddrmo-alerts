import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { listBarangays, listRadioOperators, listZones } from '@/lib/data/admin';
import { OperatorsManager } from './operators-manager';

export const metadata: Metadata = { title: 'Radio Operators' };

export default async function RadioOperatorsPage() {
  await requireStaff();
  const [zones, barangays, operators] = await Promise.all([listZones(), listBarangays(), listRadioOperators()]);
  return <OperatorsManager zones={zones} barangays={barangays} operators={operators} />;
}
