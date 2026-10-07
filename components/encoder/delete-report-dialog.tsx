'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { deleteReport } from '@/lib/actions/report-actions';
import { formatMilitaryTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function DeleteReportDialog({ reportId, reportAt }: { reportId: string; reportAt: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const expected = formatMilitaryTime(reportAt);

  return (
    <section aria-labelledby="danger-heading" className="rounded-xl border border-danger/40 p-4">
      <h2 id="danger-heading" className="font-bold text-danger">Danger zone</h2>
      <p className="mb-3 text-sm text-muted-foreground">Deleting removes this report from the public site permanently.</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setText('');
          setError(null);
        }}
      >
        <DialogTrigger className={cn(buttonVariants({ variant: 'destructive' }), 'h-11 cursor-pointer')}>
          <Trash2 aria-hidden /> Delete report
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
            <DialogDescription>Type <strong>{expected}</strong> to confirm. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <FormField label="Report time" htmlFor="confirm-delete" error={error ?? undefined}>
            <Input id="confirm-delete" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="h-11" />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="h-11 cursor-pointer"
              disabled={pending || text.trim().toUpperCase() !== expected}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await deleteReport(reportId, text);
                    if (result && !result.ok) setError(result.message);
                  } catch {
                    setError("Couldn't delete the report. Check your connection and try again.");
                  }
                })
              }
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
