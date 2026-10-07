import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/data/admin';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireSuperAdmin();
  return <SettingsForm settings={await getSettings()} />;
}
