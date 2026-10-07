import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listOptions } from '@/lib/data/admin';
import { OptionsManager } from './options-manager';

export const metadata: Metadata = { title: 'Options' };

export default async function OptionsPage() {
  await requireSuperAdmin();
  return <OptionsManager options={await listOptions()} />;
}
