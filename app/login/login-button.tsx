'use client';

import { LoaderCircle, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getBrowserClient } from '@/lib/supabase/browser';

export function LoginButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await getBrowserClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" size="lg" onClick={signIn} disabled={pending} className="h-12 w-full cursor-pointer text-base">
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        Sign in with Google
      </Button>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-danger">{error}</p>}
    </>
  );
}
