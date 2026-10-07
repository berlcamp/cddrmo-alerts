'use client';

import { ShareButtons } from '@/components/report/share-buttons';
import { Input } from '@/components/ui/input';
import { facebookDebuggerUrl } from '@/lib/site';

export function SharePanel({ url, title }: { url: string; title: string }) {
  return (
    <section aria-labelledby="share-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="share-heading" className="text-lg font-bold">Share</h2>
      <Input readOnly value={url} aria-label="Public link" className="h-11" onFocus={(e) => e.currentTarget.select()} />
      <ShareButtons url={url} title={title} />
      <p className="text-sm text-muted-foreground">
        Facebook showing an old preview?{' '}
        <a href={facebookDebuggerUrl(url)} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline-offset-4 hover:underline">
          Open the Sharing Debugger
        </a>{' '}
        and press &ldquo;Scrape Again&rdquo;.
      </p>
    </section>
  );
}
