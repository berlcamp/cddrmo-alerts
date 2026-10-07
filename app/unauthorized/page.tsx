import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = { title: 'Not authorized', robots: { index: false } };

export default function UnauthorizedPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 size-10 text-danger" aria-hidden />
        <h1 className="mb-2 text-xl font-bold">This account isn&apos;t authorized</h1>
        <p className="mb-6 text-muted-foreground">
          Your Google account is not on the CDRRMO staff list. Contact the CDRRMO administrator to be added.
        </p>
        <div className="flex justify-center gap-4 font-bold">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">Try another account</Link>
          <Link href="/" className="text-primary underline-offset-4 hover:underline">Public reports</Link>
        </div>
      </div>
    </main>
  );
}
