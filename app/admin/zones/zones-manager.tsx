'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { Zone } from '@/lib/types';
import { moveZone, saveZone } from './actions';

function ZoneForm({ zone, barangayCount }: { zone?: Zone; barangayCount?: number }) {
  const key = zone?.id ?? 'new';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveZone(prev, formData);
    if (result.ok) toast.success(zone ? `${formData.get('name')} saved` : 'Zone added');
    return result;
  }, null);
  return (
    <form action={formAction} className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <FormField label="Name" htmlFor={`zone-name-${key}`}>
        <Input id={`zone-name-${key}`} name="name" defaultValue={zone?.name} required className="h-11" />
      </FormField>
      <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : zone ? 'Save' : 'Add'}</Button>
      {barangayCount !== undefined && (
        <p className="text-sm text-muted-foreground sm:col-span-2">{barangayCount === 1 ? '1 barangay' : `${barangayCount} barangays`}</p>
      )}
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2">{state.message}</p>}
    </form>
  );
}

function ZoneRow({ zone, barangayCount, isFirst, isLast }: { zone: Zone; barangayCount: number; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();
  const move = (direction: 'up' | 'down') =>
    startTransition(async () => {
      try {
        const result = await moveZone(zone.id, direction);
        if (!result.ok) toast.error(result.message);
      } catch {
        toast.error("Couldn't move it. Check your connection and try again.");
      }
    });
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
      <ZoneForm zone={zone} barangayCount={barangayCount} />
      <div className="flex gap-1 sm:pt-6">
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${zone.name} up`} disabled={isFirst || pending} onClick={() => move('up')}>
          <ArrowUp aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${zone.name} down`} disabled={isLast || pending} onClick={() => move('down')}>
          <ArrowDown aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function ZonesManager({ zones, barangayCounts }: { zones: Zone[]; barangayCounts: Record<string, number> }) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Zones</h1>
        <p className="text-muted-foreground">Zones group barangays in the roll call and on the public report. Changes apply to new reports; existing reports keep the zone names they were created with. Use the arrows to set the zone order.</p>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {zones.map((zone, i) => (
          <li key={zone.id}>
            <ZoneRow zone={zone} barangayCount={barangayCounts[zone.id] ?? 0} isFirst={i === 0} isLast={i === zones.length - 1} />
          </li>
        ))}
      </ul>
      <section aria-labelledby="add-zone" className="rounded-xl border bg-card p-4">
        <h2 id="add-zone" className="mb-3 font-bold">Add a zone</h2>
        <ZoneForm />
      </section>
    </div>
  );
}
