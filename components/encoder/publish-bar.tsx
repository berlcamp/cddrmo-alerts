'use client';

import { Send } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { publishReport } from '@/lib/actions/report-actions';
import type { Report } from '@/lib/types';

/** Shown while the report is a draft: changes auto-save privately until the encoder publishes. */
export function PublishBar({ reportId, hasUnsaved, onPublished }: { reportId: string; hasUnsaved: boolean; onPublished: (report: Report) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby="draft-heading" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn-soft p-4">
      <div>
        <h2 id="draft-heading" className="font-bold text-warn">Draft — not on the public site yet</h2>
        <p className="text-sm text-muted-foreground">
          Pre-filled from the latest published report. Every change saves automatically; the public sees it only after you publish.
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        disabled={pending || hasUnsaved}
        className="h-11 cursor-pointer"
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await publishReport(reportId);
              if (!result.ok) toast.error(result.message);
              else {
                onPublished(result.data);
                toast.success('Published. The report is now live on the public site.');
              }
            } catch {
              toast.error('No connection. The report was not published — try again.');
            }
          })
        }
      >
        <Send aria-hidden /> {pending ? 'Publishing…' : hasUnsaved ? 'Saving changes…' : 'Publish report'}
      </Button>
    </section>
  );
}
