import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Report not found</h1>
      <p className="mt-2 text-muted-foreground">This report doesn&apos;t exist or was removed.</p>
      <div className="mt-6 flex justify-center gap-6 font-bold">
        <Link href="/" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">Current report</Link>
        <Link href="/reports" className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">All reports</Link>
      </div>
    </main>
  );
}
