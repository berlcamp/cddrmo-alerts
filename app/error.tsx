'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Couldn&apos;t load the report</h1>
      <p className="mt-2 text-muted-foreground">Something went wrong or the connection dropped. Please try again.</p>
      <Button type="button" className="mt-6 h-11 cursor-pointer px-6 text-base" onClick={() => reset()}>
        Try again
      </Button>
      <div className="mt-6 flex justify-center gap-6 font-bold">
        <Link href="/" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Current report</Link>
        <Link href="/reports" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">All reports</Link>
      </div>
    </main>
  );
}
