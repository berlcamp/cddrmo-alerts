'use client';

import { Anchor, MapPinOff, Pencil, Plus, RadioOff, Search } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCard, RowTag } from '@/components/admin/parts';
import { SortableList } from '@/components/admin/sortable-list';
import { FormField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { Barangay, Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { reorderBarangays, saveBarangay } from './actions';

const SELECT = 'h-11 w-full rounded-md border border-input bg-card px-3 text-base';

function BarangayDialog({ zones, barangay }: { zones: Zone[]; barangay?: Barangay }) {
  const [open, setOpen] = useState(false);
  const key = barangay?.id ?? 'new';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveBarangay(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success(barangay ? `${formData.get('name')} saved` : 'Barangay added');
    }
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {barangay ? (
        <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-11 cursor-pointer')} aria-label={`Edit ${barangay.name}`}>
          <Pencil aria-hidden /> <span className="hidden sm:inline">Edit</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
          <Plus aria-hidden /> Add barangay
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{barangay ? `Edit ${barangay.name}` : 'Add a barangay'}</DialogTitle>
          <DialogDescription>Changes apply to new reports. Existing reports keep what they were created with.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {barangay && <input type="hidden" name="id" value={barangay.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor={`name-${key}`}>
              <Input id={`name-${key}`} name="name" defaultValue={barangay?.name} required className="h-11" />
            </FormField>
            <FormField label="Callsign" htmlFor={`callsign-${key}`}>
              <Input id={`callsign-${key}`} name="callsign" defaultValue={barangay?.callsign} required className="h-11" />
            </FormField>
          </div>
          <FormField label="Zone" htmlFor={`zone-${key}`}>
            <select id={`zone-${key}`} name="zone_id" defaultValue={barangay?.zone_id ?? zones[0]?.id} className={SELECT}>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
            </select>
          </FormField>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Map location</legend>
            <p className="text-sm text-muted-foreground">Places the barangay on the public map. Right-click a spot in Google Maps to copy both numbers.</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Latitude" htmlFor={`lat-${key}`}>
                <Input id={`lat-${key}`} name="latitude" inputMode="decimal" defaultValue={barangay?.latitude ?? ''} placeholder="8.15" className="h-11" />
              </FormField>
              <FormField label="Longitude" htmlFor={`lng-${key}`}>
                <Input id={`lng-${key}`} name="longitude" inputMode="decimal" defaultValue={barangay?.longitude ?? ''} placeholder="123.80" className="h-11" />
              </FormField>
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Settings</legend>
            <CheckCard name="monitors_coastal" label="Coastal" hint="Reports include a coastal water level." defaultChecked={barangay?.monitors_coastal ?? false} />
            <CheckCard name="is_active" label="Active" hint="Included in the roll call of new reports." defaultChecked={barangay?.is_active ?? true} />
            <CheckCard name="no_radio" label="No radio capability" hint="Shown on the barangay reports table." defaultChecked={barangay?.no_radio ?? false} />
          </fieldset>
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : barangay ? 'Save changes' : 'Add barangay'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BarangayDetails({ barangay, zones, position }: { barangay: Barangay; zones: Zone[]; position: number }) {
  const located = barangay.latitude !== null && barangay.longitude !== null;
  return (
    <>
      <span className="w-6 shrink-0 text-right text-sm tabular text-muted-foreground">{position}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-bold', !barangay.is_active && 'text-muted-foreground')}>
          {barangay.name}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{barangay.callsign}</span>
        </p>
        {(!barangay.is_active || barangay.monitors_coastal || barangay.no_radio || !located) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {!barangay.is_active && <RowTag label="Inactive" className="bg-muted text-muted-foreground ring-1 ring-border" />}
            {barangay.monitors_coastal && <RowTag icon={Anchor} label="Coastal" className="bg-brand/10 text-brand" />}
            {barangay.no_radio && <RowTag icon={RadioOff} label="No radio capability" className="bg-warn-soft text-warn" />}
            {!located && <RowTag icon={MapPinOff} label="Not on map" className="bg-muted text-muted-foreground" />}
          </div>
        )}
      </div>
      <BarangayDialog zones={zones} barangay={barangay} />
    </>
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

export function BarangaysManager({ zones, barangays }: { zones: Zone[]; barangays: Barangay[] }) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const stats = useMemo(() => ({
    active: barangays.filter((b) => b.is_active).length,
    coastal: barangays.filter((b) => b.monitors_coastal).length,
    noRadio: barangays.filter((b) => b.no_radio).length,
    unmapped: barangays.filter((b) => b.latitude === null || b.longitude === null).length,
  }), [barangays]);
  const matches = (b: Barangay) => !term || b.name.toLowerCase().includes(term) || b.callsign.toLowerCase().includes(term);
  const visible = zones
    .map((zone) => {
      const rows = barangays.filter((b) => b.zone_id === zone.id).sort((a, b) => a.sort_order - b.sort_order);
      return { zone, rows, shown: rows.filter(matches) };
    })
    .filter(({ shown }) => shown.length > 0 || !term);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Barangays</h1>
          <p className="text-muted-foreground">The roll call for new reports, in order. Drag the handle to reorder within a zone. Existing reports keep the names and callsigns they were created with.</p>
        </div>
        <BarangayDialog zones={zones} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`Active of ${barangays.length}`} value={stats.active} />
        <Stat label="Coastal" value={stats.coastal} />
        <Stat label="No radio" value={stats.noRadio} />
        <Stat label="Not on map" value={stats.unmapped} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or callsign"
          aria-label="Search barangays"
          className="h-11 pl-9"
        />
      </div>

      {visible.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">No barangay matches “{query.trim()}”.</p>}

      {visible.map(({ zone, rows, shown }) => (
        <section key={zone.id} aria-labelledby={`zone-${zone.id}`}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id={`zone-${zone.id}`} className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{zone.name}</h2>
            <span className="text-xs font-bold text-muted-foreground">{rows.length} {rows.length === 1 ? 'barangay' : 'barangays'}</span>
          </div>
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No barangays in this zone yet. Add one, or pick this zone when editing a barangay.</p>
          ) : (
            <SortableList
              items={rows.map((row) => ({ ...row, label: row.name }))}
              onReorder={(ids) => reorderBarangays(zone.id, ids)}
              sortable={!term}
              visible={matches}
              rowClassName={(row) => !row.is_active && 'bg-muted/40'}
            >
              {(row, position) => <BarangayDetails barangay={row} zones={zones} position={position} />}
            </SortableList>
          )}
        </section>
      ))}
    </div>
  );
}
