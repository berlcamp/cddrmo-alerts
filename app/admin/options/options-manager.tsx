'use client';

import { Map as MapIcon, Pencil, Plus, Wind, CloudSun, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCard, RowTag, SectionHeader } from '@/components/admin/parts';
import { SortableList } from '@/components/admin/sortable-list';
import { FormField } from '@/components/form-field';
import { ConditionDot } from '@/components/report/condition-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import { makeConditionLooker } from '@/lib/map/conditions';
import type { ConditionKind, ConditionOption, Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { reorderOptions, reorderZones, saveOption, saveZone } from './actions';

export type OptionsTab = 'zones' | ConditionKind;

function EditTrigger({ label }: { label: string }) {
  return (
    <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'h-11 shrink-0 cursor-pointer')} aria-label={`Edit ${label}`}>
      <Pencil aria-hidden /> <span className="hidden sm:inline">Edit</span>
    </DialogTrigger>
  );
}

function AddTrigger({ label }: { label: string }) {
  return (
    <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
      <Plus aria-hidden /> {label}
    </DialogTrigger>
  );
}

/** Dialog state shared by the add/edit forms: closes and toasts on success. */
function useDialogForm(action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>, success: (formData: FormData) => string) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success(success(formData));
    }
    return result;
  }, null);
  return { open, setOpen, state, formAction, pending };
}

function ZoneDialog({ zone }: { zone?: Zone }) {
  const { open, setOpen, state, formAction, pending } = useDialogForm(saveZone, (formData) => (zone ? `${formData.get('name')} saved` : 'Zone added'));
  const key = zone?.id ?? 'new';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {zone ? <EditTrigger label={zone.name} /> : <AddTrigger label="Add zone" />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{zone ? `Edit ${zone.name}` : 'Add a zone'}</DialogTitle>
          <DialogDescription>Existing reports keep the zone names they were created with.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {zone && <input type="hidden" name="id" value={zone.id} />}
          <FormField label="Name" htmlFor={`zone-name-${key}`}>
            <Input id={`zone-name-${key}`} name="name" defaultValue={zone?.name} required className="h-11" />
          </FormField>
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : zone ? 'Save changes' : 'Add zone'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const KIND: Record<ConditionKind, { title: string; noun: string; description: string; icon: LucideIcon }> = {
  weather: {
    title: 'Weather situation',
    noun: 'weather option',
    description: 'Choices encoders tap for the weather. Drag to set the order they appear in.',
    icon: CloudSun,
  },
  wind: {
    title: 'Wind situation',
    noun: 'wind option',
    description: 'Choices encoders tap for the wind. Drag to set the order they appear in.',
    icon: Wind,
  },
};

function OptionDialog({ kind, option }: { kind: ConditionKind; option?: ConditionOption }) {
  const { open, setOpen, state, formAction, pending } = useDialogForm(saveOption, () => (option ? 'Saved' : 'Option added'));
  const key = option?.id ?? `new-${kind}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {option ? <EditTrigger label={option.label} /> : <AddTrigger label={`Add ${KIND[kind].noun}`} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{option ? `Edit ${option.label}` : `Add a ${KIND[kind].noun}`}</DialogTitle>
          <DialogDescription>Deactivate an option instead of deleting it, so older reports keep their labels.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />
          {option && <input type="hidden" name="id" value={option.id} />}
          <FormField label="Label" htmlFor={`label-${key}`}>
            <Input id={`label-${key}`} name="label" defaultValue={option?.label} required className="h-11" />
          </FormField>
          <FormField label="Severity" htmlFor={`severity-${key}`} hint="0 is calmest; higher is worse. Sets the colour on the map and the “average” summary.">
            <Input id={`severity-${key}`} name="severity" type="number" min={0} max={20} defaultValue={option?.severity ?? 0} required className="h-11 w-32" />
          </FormField>
          <CheckCard name="is_active" label="Active" hint="Encoders can pick it on new entries." defaultChecked={option?.is_active ?? true} />
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : option ? 'Save changes' : 'Add option'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmptyList({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function ZonesPanel({ zones, barangayCounts }: { zones: Zone[]; barangayCounts: Record<string, number> }) {
  return (
    <section aria-labelledby="zones-title" className="space-y-4">
      <SectionHeader
        id="zones-title"
        title="Zones"
        description="Zones group barangays in the roll call and on the public report. Drag to set their order."
        action={<ZoneDialog />}
      />
      {zones.length === 0 ? (
        <EmptyList>No zones yet.</EmptyList>
      ) : (
        <SortableList items={zones.map((zone) => ({ ...zone, label: zone.name }))} onReorder={reorderZones}>
          {(zone, position) => {
            const count = barangayCounts[zone.id] ?? 0;
            return (
              <>
                <span className="w-6 shrink-0 text-right text-sm tabular text-muted-foreground">{position}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{zone.name}</p>
                  <p className="text-sm text-muted-foreground">{count === 1 ? '1 barangay' : `${count} barangays`}</p>
                </div>
                <ZoneDialog zone={zone} />
              </>
            );
          }}
        </SortableList>
      )}
    </section>
  );
}

function OptionsPanel({ kind, options, allOptions }: { kind: ConditionKind; options: ConditionOption[]; allOptions: ConditionOption[] }) {
  const look = useMemo(() => makeConditionLooker(allOptions), [allOptions]);
  return (
    <section aria-labelledby={`${kind}-title`} className="space-y-4">
      <SectionHeader id={`${kind}-title`} title={KIND[kind].title} description={KIND[kind].description} action={<OptionDialog kind={kind} />} />
      {options.length === 0 ? (
        <EmptyList>No options yet.</EmptyList>
      ) : (
        <SortableList
          items={options.map((option) => ({ ...option, label: option.label }))}
          onReorder={(ids) => reorderOptions(kind, ids)}
          rowClassName={(option) => !option.is_active && 'bg-muted/40'}
        >
          {(option) => (
            <>
              <ConditionDot look={look(option.id)} className={cn('size-8', !option.is_active && 'opacity-50')} />
              <div className="min-w-0 flex-1">
                <p className={cn('font-bold', !option.is_active && 'text-muted-foreground')}>{option.label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <RowTag label={`Severity ${option.severity}`} className="bg-muted text-muted-foreground" />
                  {!option.is_active && <RowTag label="Inactive" className="bg-muted text-muted-foreground ring-1 ring-border" />}
                </div>
              </div>
              <OptionDialog kind={kind} option={option} />
            </>
          )}
        </SortableList>
      )}
    </section>
  );
}

export function OptionsManager({ tab, zones, barangayCounts, options }: {
  tab: OptionsTab;
  zones: Zone[];
  barangayCounts: Record<string, number>;
  options: ConditionOption[];
}) {
  const byKind = (kind: ConditionKind) => options.filter((o) => o.kind === kind).sort((a, b) => a.sort_order - b.sort_order);
  const tabs: { id: OptionsTab; label: string; icon: LucideIcon; count: number }[] = [
    { id: 'zones', label: 'Zones', icon: MapIcon, count: zones.length },
    { id: 'weather', label: 'Weather', icon: KIND.weather.icon, count: byKind('weather').length },
    { id: 'wind', label: 'Wind', icon: KIND.wind.icon, count: byKind('wind').length },
  ];
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Options</h1>
        <p className="text-muted-foreground">The zones and condition choices used in the roll call. Changes apply to new reports.</p>
      </div>
      <nav aria-label="Option lists" className="flex gap-1 overflow-x-auto rounded-xl border bg-muted p-1">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <Link
            key={id}
            href={`/admin/options?tab=${id}`}
            replace
            scroll={false}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors duration-150',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular">{count}</span>
          </Link>
        ))}
      </nav>
      {tab === 'zones' ? (
        <ZonesPanel zones={zones} barangayCounts={barangayCounts} />
      ) : (
        <OptionsPanel key={tab} kind={tab} options={byKind(tab)} allOptions={options} />
      )}
    </div>
  );
}
