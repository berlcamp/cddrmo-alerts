'use client';

import { LoaderCircle, RadioTower } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { getBarangayAttendance, setAttendance, type OperatorAttendance } from '@/app/admin/radio-operators/actions';
import { buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatShortDay } from '@/lib/attendance';
import { cn } from '@/lib/utils';

type Load = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; operators: OperatorAttendance[] };

/** Opens a barangay's active radio operators to mark who was present on the report's day. */
export function OperatorAttendanceDialog({ barangayId, barangayName, day, className }: {
  barangayId: string;
  barangayName: string;
  /** YYYY-MM-DD, the report's day in Manila. */
  day: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  // One save chain per operator so quick re-clicks reach the server in order.
  const chains = useRef(new Map<string, Promise<unknown>>());

  const fetchOperators = async () => {
    setLoad({ state: 'loading' });
    try {
      const result = await getBarangayAttendance(barangayId, day);
      setLoad(result.ok ? { state: 'ready', operators: result.data } : { state: 'failed', message: result.message });
    } catch {
      setLoad({ state: 'failed', message: "Couldn't load the radio operators. Check your connection and try again." });
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void fetchOperators();
  };

  const apply = (id: string, present: boolean) =>
    setLoad((prev) => (prev.state === 'ready' ? { ...prev, operators: prev.operators.map((o) => (o.id === id ? { ...o, present } : o)) } : prev));

  const toggle = (operator: OperatorAttendance, present: boolean) => {
    apply(operator.id, present);
    const run = (chains.current.get(operator.id) ?? Promise.resolve()).then(async () => {
      try {
        const result = await setAttendance(operator.id, day, present);
        if (!result.ok) {
          apply(operator.id, !present);
          toast.error(result.message);
        }
      } catch {
        apply(operator.id, !present);
        toast.error(`Couldn't save ${operator.name}'s attendance. Check your connection and try again.`);
      }
    });
    chains.current.set(operator.id, run);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer whitespace-nowrap', className)}
        aria-label={`Radio operators – ${barangayName}`}
      >
        <RadioTower aria-hidden /> Radio Operator
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{barangayName} radio operators</DialogTitle>
          <DialogDescription>Check the operators present on {formatShortDay(day)}. Changes save automatically.</DialogDescription>
        </DialogHeader>
        {load.state === 'loading' && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading operators…
          </p>
        )}
        {load.state === 'failed' && (
          <div role="alert" className="space-y-2 py-2">
            <p className="text-sm font-bold text-danger">{load.message}</p>
            <button type="button" onClick={() => void fetchOperators()} className={cn(buttonVariants({ variant: 'outline' }), 'h-11 cursor-pointer')}>Try again</button>
          </div>
        )}
        {load.state === 'ready' &&
          (load.operators.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active radio operators for this barangay.{' '}
              <Link href="/admin/radio-operators" className="font-bold text-primary underline-offset-4 hover:underline">Manage operators</Link>
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {load.operators.map((o) => (
                <li key={o.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-accent/60">
                    <input
                      type="checkbox"
                      checked={o.present}
                      onChange={(event) => toggle(o, event.target.checked)}
                      className="size-5 shrink-0 cursor-pointer accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block font-bold">{o.name}</span>
                      {(o.callsign || o.position) && (
                        <span className="block text-sm text-muted-foreground">{[o.callsign, o.position].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ))}
      </DialogContent>
    </Dialog>
  );
}
