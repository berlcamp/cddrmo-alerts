'use client';

import { Radio } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMilitaryTime } from '@/lib/format';

const BUTTON = 'ml-auto inline-flex min-h-11 cursor-pointer items-center rounded-md bg-primary-foreground px-4 font-bold text-primary';

export function NewReportBanner({ newer, onLatestPage }: { newer: { id: string; report_at: string } | null; onLatestPage: boolean }) {
  const router = useRouter();
  if (!newer) return null;
  return (
    <div role="status" className="sticky top-0 z-30 bg-primary text-primary-foreground shadow">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Radio className="size-5 shrink-0" aria-hidden />
        <p className="font-bold">A new netcall report ({formatMilitaryTime(newer.report_at)}) has started.</p>
        {onLatestPage ? (
          <button type="button" className={BUTTON} onClick={() => router.refresh()}>View</button>
        ) : (
          <Link href="/" className={BUTTON}>View</Link>
        )}
      </div>
    </div>
  );
}
