import type { Metadata } from 'next';
import { Radio } from 'lucide-react';
import { safeNextPath } from '@/lib/auth-redirect';
import { LoginButton } from './login-button';

export const metadata: Metadata = { title: 'Staff sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-brand px-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 text-card-foreground shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <Radio className="size-8 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-muted-foreground">CDRRMO Ozamiz</p>
            <h1 className="text-xl font-bold">Staff sign in</h1>
          </div>
        </div>
        <p className="mb-6 text-muted-foreground">Use the Google account your CDRRMO administrator added.</p>
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 font-bold text-danger">
            Sign-in failed. Please try again.
          </p>
        )}
        <LoginButton next={safeNextPath(next)} />
      </div>
    </main>
  );
}
