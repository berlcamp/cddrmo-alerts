'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', superOnly: false, exact: true },
  { href: '/admin/reports', label: 'Reports', superOnly: false },
  { href: '/admin/barangays', label: 'Barangays', superOnly: false },
  { href: '/admin/options', label: 'Options', superOnly: false },
  { href: '/admin/settings', label: 'Settings', superOnly: false },
  { href: '/admin/users', label: 'Users', superOnly: true },
];

export function AdminNav({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {ITEMS.filter((item) => isSuperAdmin || !item.superOnly).map((item) => {
        const active = 'exact' in item ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn('inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold transition-colors', active ? 'bg-white/15' : 'hover:bg-white/10')}
          >
            {item.label}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-bold hover:bg-white/10">
        Public site ↗
      </Link>
    </nav>
  );
}
