'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { Barangay, Zone } from '@/lib/types';
import { moveBarangay, saveBarangay } from './actions';

const SELECT = 'h-11 w-full rounded-md border border-input bg-card px-3 text-base';
const CHECK = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold';

function BarangayForm({ zones, barangay }: { zones: Zone[]; barangay?: Barangay }) {
  const key = barangay?.id ?? 'new';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveBarangay(prev, formData);
    if (result.ok) toast.success(barangay ? `${formData.get('name')} saved` : 'Barangay added');
    return result;
  }, null);
  return (
    <form action={formAction} className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1.3fr_auto_auto_auto] lg:items-end">
      {barangay && <input type="hidden" name="id" value={barangay.id} />}
      <FormField label="Name" htmlFor={`name-${key}`}>
        <Input id={`name-${key}`} name="name" defaultValue={barangay?.name} required className="h-11" />
      </FormField>
      <FormField label="Callsign" htmlFor={`callsign-${key}`}>
        <Input id={`callsign-${key}`} name="callsign" defaultValue={barangay?.callsign} required className="h-11" />
      </FormField>
      <FormField label="Zone" htmlFor={`zone-${key}`}>
        <select id={`zone-${key}`} name="zone_id" defaultValue={barangay?.zone_id ?? zones[0]?.id} className={SELECT}>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </FormField>
      <label className={CHECK}>
        <input type="checkbox" name="monitors_coastal" defaultChecked={barangay?.monitors_coastal ?? false} className="size-5 accent-primary" /> Coastal
      </label>
      <label className={CHECK}>
        <input type="checkbox" name="is_active" defaultChecked={barangay?.is_active ?? true} className="size-5 accent-primary" /> Active
      </label>
      <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : barangay ? 'Save' : 'Add'}</Button>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2 lg:col-span-6">{state.message}</p>}
    </form>
  );
}

function BarangayRow({ barangay, zones, isFirst, isLast }: { barangay: Barangay; zones: Zone[]; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();
  const move = (direction: 'up' | 'down') =>
    startTransition(async () => {
      try {
        const result = await moveBarangay(barangay.id, direction);
        if (!result.ok) toast.error(result.message);
      } catch {
        toast.error("Couldn't move it. Check your connection and try again.");
      }
    });
  return (
    <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end">
      <BarangayForm zones={zones} barangay={barangay} />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${barangay.name} up`} disabled={isFirst || pending} onClick={() => move('up')}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${barangay.name} down`} disabled={isLast || pending} onClick={() => move('down')}>
          <ArrowDown aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function BarangaysManager({ zones, barangays }: { zones: Zone[]; barangays: Barangay[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Barangays</h1>
        <p className="text-muted-foreground">Changes apply to new reports. Existing reports keep the names and callsigns they were created with. Use the arrows to set the roll-call order.</p>
      </div>
      {zones.map((zone) => {
        const rows = barangays.filter((b) => b.zone_id === zone.id).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <section key={zone.id} aria-label={`${zone.name} barangays`}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{zone.name}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((barangay, i) => (
                <li key={barangay.id}>
                  <BarangayRow barangay={barangay} zones={zones} isFirst={i === 0} isLast={i === rows.length - 1} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="add-barangay" className="rounded-xl border bg-card p-4">
        <h2 id="add-barangay" className="mb-3 font-bold">Add a barangay</h2>
        <BarangayForm zones={zones} />
      </section>
    </div>
  );
}
