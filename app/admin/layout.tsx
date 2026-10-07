import type { Metadata } from 'next';
import Link from 'next/link';
import { LogOut, Radio } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { AdminNav } from './admin-nav';
import { signOut } from './auth-actions';

export const metadata: Metadata = { title: 'Staff', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-dvh">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/admin/reports" className="flex min-h-11 items-center gap-2 font-bold">
            <Radio className="size-5" aria-hidden /> CDRRMO SitRep
          </Link>
          <AdminNav isSuperAdmin={staff.role === 'super_admin'} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{staff.full_name || staff.email}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 font-bold hover:bg-white/10">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
