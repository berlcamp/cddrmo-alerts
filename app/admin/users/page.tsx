import type { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { listStaff } from '@/lib/data/admin';
import { UsersManager } from './users-manager';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  await requireSuperAdmin();
  return <UsersManager users={await listStaff()} />;
}
