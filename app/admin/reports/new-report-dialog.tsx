'use client';

import { Plus } from 'lucide-react';
import { useActionState, useState } from 'react';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import { toManilaInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createReport } from './actions';

function NewReportForm({ defaultName, defaultPosition }: { defaultName: string; defaultPosition: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(createReport, null);
  const [defaultTime] = useState(() => toManilaInputValue(new Date().toISOString()));
  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Netcall date and time (Philippine time)" htmlFor="report_at_local">
        <Input id="report_at_local" name="report_at_local" type="datetime-local" defaultValue={defaultTime} required className="h-11" />
      </FormField>
      <FormField label="Prepared by" htmlFor="prepared_by_name">
        <Input id="prepared_by_name" name="prepared_by_name" defaultValue={defaultName} required className="h-11" />
      </FormField>
      <FormField label="Position" htmlFor="prepared_by_position">
        <Input id="prepared_by_position" name="prepared_by_position" defaultValue={defaultPosition} className="h-11" />
      </FormField>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Starting…' : 'Start report'}</Button>
      </DialogFooter>
    </form>
  );
}

export function NewReportDialog({ defaultName, defaultPosition }: { defaultName: string; defaultPosition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
        <Plus aria-hidden /> New netcall report
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New netcall report</DialogTitle>
          <DialogDescription>
            It starts as a draft pre-filled from the latest published report. Changes save automatically and stay off the
            public site until you publish.
          </DialogDescription>
        </DialogHeader>
        {open && <NewReportForm defaultName={defaultName} defaultPosition={defaultPosition} />}
      </DialogContent>
    </Dialog>
  );
}
