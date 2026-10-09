'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { buttonVariants } from '@/components/ui/button';
import { formatMonth, monthDays, shiftMonth } from '@/lib/attendance';
import type { RadioOperator } from '@/lib/types';
import { cn } from '@/lib/utils';
import { setAttendance } from '../actions';

const cellKey = (operatorId: string, day: string) => `${operatorId}|${day}`;
const monthHref = (month: string) => `/admin/radio-operators/attendance?month=${month}`;

export function AttendanceGrid({ month, today, operators, barangayNames, present: initial }: {
  month: string;
  today: string;
  operators: RadioOperator[];
  barangayNames: Record<string, string>;
  present: string[];
}) {
  const [present, setPresent] = useState(() => new Set(initial));
  // One save chain per cell so quick re-clicks reach the server in order.
  const chains = useRef(new Map<string, Promise<unknown>>());
  const days = monthDays(month);
  const thisMonth = today.slice(0, 7);
  const isFutureMonth = month > thisMonth;
  const scroller = useRef<HTMLDivElement>(null);

  // Scroll so today (or the last day of a past month) is the last day in view, next to the totals column.
  useEffect(() => {
    const box = scroller.current;
    const target = box?.querySelector<HTMLElement>('[data-today]') ?? [...(box?.querySelectorAll<HTMLElement>('th[data-day]') ?? [])].at(-1);
    const totals = box?.querySelector<HTMLElement>('thead th:last-child');
    if (box && target && totals) box.scrollLeft = target.offsetLeft + target.offsetWidth + totals.offsetWidth - box.clientWidth;
  }, []);

  const toggle = (operator: RadioOperator, day: string, next: boolean) => {
    const key = cellKey(operator.id, day);
    const apply = (value: boolean) =>
      setPresent((prev) => {
        const copy = new Set(prev);
        if (value) copy.add(key);
        else copy.delete(key);
        return copy;
      });
    apply(next);
    const run = (chains.current.get(key) ?? Promise.resolve()).then(async () => {
      try {
        const result = await setAttendance(operator.id, day, next);
        if (!result.ok) {
          apply(!next);
          toast.error(result.message);
        }
      } catch {
        apply(!next);
        toast.error(`Couldn't save ${operator.name}'s attendance. Check your connection and try again.`);
      }
    });
    chains.current.set(key, run);
  };

  // Operators arrive in roll-call order, so each barangay's operators are already next to each other.
  const groups: { barangayId: string; operators: RadioOperator[] }[] = [];
  for (const o of operators) {
    const last = groups[groups.length - 1];
    if (last?.barangayId === o.barangay_id) last.operators.push(o);
    else groups.push({ barangayId: o.barangay_id, operators: [o] });
  }

  const dayTotal = (day: string) => operators.filter((o) => present.has(cellKey(o.id, day))).length;
  const operatorTotal = (o: RadioOperator) => days.filter((d) => present.has(cellKey(o.id, d.key))).length;

  return (
    <div className="space-y-6">
      <Link href="/admin/radio-operators" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Radio Operators
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Operator attendance</h1>
          <p className="text-muted-foreground">Tick a day when the operator was present or reported. Changes save as you tick.</p>
        </div>
        <nav aria-label="Choose month" className="flex items-center gap-1">
          <Link href={monthHref(shiftMonth(month, -1))} aria-label="Previous month" className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-11')}>
            <ChevronLeft aria-hidden />
          </Link>
          <p className="min-w-40 text-center text-lg font-bold tabular" aria-live="polite">{formatMonth(month)}</p>
          <Link href={monthHref(shiftMonth(month, 1))} aria-label="Next month" className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'size-11')}>
            <ChevronRight aria-hidden />
          </Link>
          {month !== thisMonth && (
            <Link href={monthHref(thisMonth)} className={cn(buttonVariants({ variant: 'ghost' }), 'h-11')}>This month</Link>
          )}
        </nav>
      </div>

      {operators.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="font-bold">No active radio operators</p>
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/radio-operators" className="font-bold text-primary underline-offset-4 hover:underline">Add operators</Link> first, then track their attendance here.
          </p>
        </div>
      ) : (
        <>
          {isFutureMonth && <p className="rounded-lg bg-warn-soft px-4 py-3 text-sm font-bold text-warn">This month hasn’t started yet, so there’s nothing to mark.</p>}
          <div ref={scroller} className="overflow-x-auto overscroll-x-contain rounded-xl border bg-card">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Attendance for {formatMonth(month)}. Each checkbox marks an operator present on that day.</caption>
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="sticky left-0 z-20 w-36 min-w-36 border-b bg-card px-3 sm:w-52 sm:min-w-52 py-2 text-left font-bold uppercase tracking-wide">Operator</th>
                  {days.map((d) => (
                    <th
                      key={d.key}
                      scope="col"
                      data-day
                      data-today={d.key === today || undefined}
                      className={cn('w-10 min-w-10 border-b lg:w-9 lg:min-w-9 px-0 py-1.5 text-center font-normal', d.weekend && 'bg-muted/60', d.key === today && 'bg-primary text-primary-foreground')}
                    >
                      <span className="block text-[11px] leading-tight">{d.weekday}</span>
                      <span className="block text-sm font-bold tabular leading-tight">{d.day}</span>
                    </th>
                  ))}
                  <th scope="col" className="sticky right-0 z-20 border-b border-l bg-card px-3 py-2 text-right font-bold uppercase tracking-wide">Days</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.barangayId}>
                  <tr>
                    <th scope="rowgroup" colSpan={days.length + 2} className="border-b bg-muted/60 p-0 text-left">
                      <span className="sticky left-0 inline-flex items-baseline gap-2 px-3 py-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider">{barangayNames[group.barangayId] ?? 'Unknown barangay'}</span>
                        <span className="text-xs text-muted-foreground">{group.operators.length} {group.operators.length === 1 ? 'operator' : 'operators'}</span>
                      </span>
                    </th>
                  </tr>
                  {group.operators.map((o) => (
                    <tr key={o.id} className="group">
                      <th scope="row" className="sticky left-0 z-10 max-w-36 border-b bg-card px-3 py-1.5 sm:max-w-52 text-left font-normal group-hover:bg-accent">
                        <span className={cn('block truncate font-bold', o.status === 'inactive' && 'text-muted-foreground')}>
                          {o.callsign || o.name}
                          {o.status === 'inactive' && <span className="ml-1.5 text-xs font-normal">(inactive)</span>}
                        </span>
                        {o.callsign && <span className="block truncate text-xs text-muted-foreground">{o.name}</span>}
                      </th>
                      {days.map((d) => {
                        const checked = present.has(cellKey(o.id, d.key));
                        const future = d.key > today;
                        return (
                          <td key={d.key} className={cn('border-b p-0 text-center group-hover:bg-accent/50', d.weekend && 'bg-muted/40', d.key === today && 'bg-primary/10')}>
                            <label className={cn('flex size-10 items-center justify-center lg:h-10 lg:w-9', future ? 'cursor-not-allowed' : 'cursor-pointer')}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={future}
                                onChange={(event) => toggle(o, d.key, event.target.checked)}
                                aria-label={`${o.callsign ? `${o.callsign}, ` : ''}${o.name} present on ${formatMonth(month).split(' ')[0]} ${d.day}`}
                                className="size-5 cursor-pointer accent-ok disabled:cursor-not-allowed disabled:opacity-30"
                              />
                            </label>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 border-b border-l bg-card px-3 text-right font-bold tabular group-hover:bg-accent">{operatorTotal(o)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot>
                <tr className="text-xs text-muted-foreground">
                  <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-bold uppercase tracking-wide">Present</th>
                  {days.map((d) => (
                    <td key={d.key} className={cn('py-2 text-center font-bold tabular', d.weekend && 'bg-muted/40')}>{d.key > today ? '' : dayTotal(d.key)}</td>
                  ))}
                  <td className="sticky right-0 z-10 border-l bg-card" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">Scroll the table sideways for more days. Shaded columns are weekends; days after today can’t be marked yet.</p>
        </>
      )}
    </div>
  );
}
