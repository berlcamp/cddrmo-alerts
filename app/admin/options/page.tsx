import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { listOptions } from '@/lib/data/admin';
import { OptionsManager } from './options-manager';

export const metadata: Metadata = { title: 'Options' };

export default async function OptionsPage() {
  await requireStaff();
  return <OptionsManager options={await listOptions()} />;
}
