'use client';

import Link from 'next/link';
import { CalendarCheck, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { useActionState, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { RowTag } from '@/components/admin/parts';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { Barangay, OperatorStatus, RadioOperator, Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { deleteOperator, saveOperator } from './actions';

const SELECT = 'h-11 w-full rounded-md border border-input bg-card px-3 text-base';
const STATUS_FILTERS = ['all', 'active', 'inactive'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function StatusTag({ status }: { status: OperatorStatus }) {
  return status === 'active'
    ? <RowTag label="Active" className="bg-ok-soft text-ok" />
    : <RowTag label="Inactive" className="bg-muted text-muted-foreground ring-1 ring-border" />;
}

function OperatorDialog({ zones, barangays, operator }: { zones: Zone[]; barangays: Barangay[]; operator?: RadioOperator }) {
  const [open, setOpen] = useState(false);
  const key = operator?.id ?? 'new';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveOperator(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success(operator ? `${formData.get('name')} saved` : 'Radio operator added');
    }
    return result;
  }, null);
  // Inactive barangays stay selectable only for an operator already assigned to one.
  const choices = (zoneId: string) =>
    barangays.filter((b) => b.zone_id === zoneId && (b.is_active || b.id === operator?.barangay_id)).sort((a, b) => a.sort_order - b.sort_order);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {operator ? (
        <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-11 cursor-pointer')} aria-label={`Edit ${operator.name}`}>
          <Pencil aria-hidden /> <span className="hidden lg:inline">Edit</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
          <Plus aria-hidden /> Add operator
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{operator ? `Edit ${operator.name}` : 'Add a radio operator'}</DialogTitle>
          <DialogDescription>The person who answers the radio roll call for a barangay.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {operator && <input type="hidden" name="id" value={operator.id} />}
          <FormField label="Barangay" htmlFor={`op-brgy-${key}`}>
            <select id={`op-brgy-${key}`} name="barangay_id" required defaultValue={operator?.barangay_id ?? ''} className={SELECT}>
              <option value="" disabled>Choose a barangay</option>
              {zones.map((zone) => (
                <optgroup key={zone.id} label={zone.name}>
                  {choices(zone.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField label="Name of operator" htmlFor={`op-name-${key}`}>
            <Input id={`op-name-${key}`} name="name" defaultValue={operator?.name} required autoComplete="off" className="h-11" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Callsign" htmlFor={`op-callsign-${key}`}>
              <Input id={`op-callsign-${key}`} name="callsign" defaultValue={operator?.callsign} autoComplete="off" className="h-11" />
            </FormField>
            <FormField label="Position" htmlFor={`op-position-${key}`}>
              <Input id={`op-position-${key}`} name="position" defaultValue={operator?.position} placeholder="e.g. BDRRM Officer" className="h-11" />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Contact number" htmlFor={`op-contact-${key}`}>
              <Input id={`op-contact-${key}`} name="contact_number" type="tel" inputMode="tel" defaultValue={operator?.contact_number} placeholder="0917 123 4567" className="h-11" />
            </FormField>
            <FormField label="Status" htmlFor={`op-status-${key}`}>
              <select id={`op-status-${key}`} name="status" defaultValue={operator?.status ?? 'active'} className={SELECT}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : operator ? 'Save changes' : 'Add operator'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ operator }: { operator: RadioOperator }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = () =>
    startTransition(async () => {
      try {
        const result = await deleteOperator(operator.id);
        if (!result.ok) return void toast.error(result.message);
        setOpen(false);
        toast.success(`${operator.name} removed`);
      } catch {
        toast.error("Couldn't remove the operator. Check your connection and try again.");
      }
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-11 cursor-pointer text-danger hover:text-danger')} aria-label={`Remove ${operator.name}`}>
        <Trash2 aria-hidden /> <span className="hidden lg:inline">Remove</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {operator.name}?</DialogTitle>
          <DialogDescription>Their attendance records are removed too. To keep the history, set the status to Inactive instead.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="destructive" className="h-11 cursor-pointer" disabled={pending} onClick={remove}>
            {pending ? 'Removing…' : 'Remove operator'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Contact({ number }: { number: string }) {
  if (!number) return <span className="text-muted-foreground">—</span>;
  return (
    <a href={`tel:${number.replace(/[^0-9+]/g, '')}`} className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary tabular underline-offset-4 hover:underline">
      <Phone className="size-4 shrink-0" aria-hidden /> {number}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-2xl font-bold tabular">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function OperatorsManager({ zones, barangays, operators }: { zones: Zone[]; barangays: Barangay[]; operators: RadioOperator[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const barangayById = useMemo(() => new Map(barangays.map((b) => [b.id, b])), [barangays]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const stats = useMemo(() => {
    const covered = new Set(operators.filter((o) => o.status === 'active').map((o) => o.barangay_id));
    return {
      active: operators.filter((o) => o.status === 'active').length,
      uncovered: barangays.filter((b) => b.is_active && !covered.has(b.id)).length,
    };
  }, [operators, barangays]);

  const term = query.trim().toLowerCase();
  const rows = operators.filter((o) => {
    if (status !== 'all' && o.status !== status) return false;
    if (!term) return true;
    const barangay = barangayById.get(o.barangay_id)?.name ?? '';
    return [o.name, o.callsign, o.position, o.contact_number, barangay].some((v) => v.toLowerCase().includes(term));
  });
  const place = (o: RadioOperator) => {
    const b = barangayById.get(o.barangay_id);
    return { barangay: b?.name ?? 'Unknown barangay', zone: b ? zoneById.get(b.zone_id)?.name ?? '' : '' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Radio Operators</h1>
          <p className="text-muted-foreground">Who answers the radio roll call for each barangay. Contact numbers are visible to staff only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/radio-operators/attendance" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11')}>
            <CalendarCheck aria-hidden /> Manage attendance
          </Link>
          <OperatorDialog zones={zones} barangays={barangays} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Operators" value={operators.length} />
        <Stat label="Active" value={stats.active} />
        <Stat label="No operator" value={stats.uncovered} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, barangay, callsign or number"
            aria-label="Search radio operators"
            className="h-11 pl-9"
          />
        </div>
        <div role="group" aria-label="Filter by status" className="flex gap-1 rounded-lg border bg-card p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'min-h-9 flex-1 cursor-pointer rounded-md px-3 text-sm font-bold capitalize transition-colors duration-150',
                status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {operators.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="font-bold">No radio operators yet</p>
          <p className="text-sm text-muted-foreground">Add the operator for each barangay to start tracking attendance.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No operator matches your search.</p>
      ) : (
        <>
          {/* Phones: one card per operator. */}
          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {rows.map((o) => {
              const { barangay, zone } = place(o);
              return (
                <li key={o.id} className={cn('space-y-2 p-4', o.status === 'inactive' && 'bg-muted/40')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{o.name}</p>
                      <p className="text-sm text-muted-foreground">{barangay}{zone && ` · ${zone}`}</p>
                    </div>
                    <StatusTag status={o.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 text-sm">
                    <dt className="text-muted-foreground">Callsign</dt><dd className="font-bold">{o.callsign || '—'}</dd>
                    <dt className="text-muted-foreground">Position</dt><dd>{o.position || '—'}</dd>
                  </dl>
                  <div className="flex items-center justify-between gap-2">
                    <Contact number={o.contact_number} />
                    <div className="flex gap-2">
                      <OperatorDialog zones={zones} barangays={barangays} operator={o} />
                      <RemoveDialog operator={o} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tablets and up: a table. */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Barangay</th>
                  <th scope="col" className="px-4 py-3">Name of operator</th>
                  <th scope="col" className="px-4 py-3">Callsign</th>
                  <th scope="col" className="px-4 py-3">Position</th>
                  <th scope="col" className="px-4 py-3">Contact number</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((o) => {
                  const { barangay, zone } = place(o);
                  return (
                    <tr key={o.id} className={cn('transition-colors duration-150 hover:bg-accent/40', o.status === 'inactive' && 'bg-muted/40 text-muted-foreground')}>
                      <td className="px-4 py-2">
                        <span className="block font-bold text-foreground">{barangay}</span>
                        {zone && <span className="block text-xs text-muted-foreground">{zone}</span>}
                      </td>
                      <td className="px-4 py-2 font-bold">{o.name}</td>
                      <td className="px-4 py-2">{o.callsign || '—'}</td>
                      <td className="px-4 py-2">{o.position || '—'}</td>
                      <td className="px-4 py-2"><Contact number={o.contact_number} /></td>
                      <td className="px-4 py-2"><StatusTag status={o.status} /></td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <OperatorDialog zones={zones} barangays={barangays} operator={o} />
                          <RemoveDialog operator={o} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
