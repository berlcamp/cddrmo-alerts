'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import type { ConditionKind, ConditionOption } from '@/lib/types';
import { moveOption, saveOption } from './actions';

function OptionForm({ kind, option }: { kind: ConditionKind; option?: ConditionOption }) {
  const key = option?.id ?? `new-${kind}`;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveOption(prev, formData);
    if (result.ok) toast.success(option ? 'Saved' : 'Option added');
    return result;
  }, null);
  return (
    <form action={formAction} className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
      <input type="hidden" name="kind" value={kind} />
      {option && <input type="hidden" name="id" value={option.id} />}
      <FormField label="Label" htmlFor={`label-${key}`}>
        <Input id={`label-${key}`} name="label" defaultValue={option?.label} required className="h-11" />
      </FormField>
      <FormField label="Severity" htmlFor={`severity-${key}`} hint={option ? undefined : '0 = calmest'}>
        <Input id={`severity-${key}`} name="severity" type="number" min={0} max={20} defaultValue={option?.severity ?? 0} required className="h-11" />
      </FormField>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="is_active" defaultChecked={option?.is_active ?? true} className="size-5 accent-primary" /> Active
      </label>
      <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : option ? 'Save' : 'Add'}</Button>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-4">{state.message}</p>}
    </form>
  );
}

function OptionRow({ option, isFirst, isLast }: { option: ConditionOption; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();
  const move = (direction: 'up' | 'down') =>
    startTransition(async () => {
      const result = await moveOption(option.id, direction);
      if (!result.ok) toast.error(result.message);
    });
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
      <OptionForm kind={option.kind} option={option} />
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${option.label} up`} disabled={isFirst || pending} onClick={() => move('up')}><ArrowUp aria-hidden /></Button>
        <Button type="button" variant="outline" size="icon" className="size-11 cursor-pointer" aria-label={`Move ${option.label} down`} disabled={isLast || pending} onClick={() => move('down')}><ArrowDown aria-hidden /></Button>
      </div>
    </div>
  );
}

const TITLES: Record<ConditionKind, string> = { weather: 'Weather situation', wind: 'Wind situation' };

export function OptionsManager({ options }: { options: ConditionOption[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Condition options</h1>
        <p className="text-muted-foreground">
          These are the choices encoders tap. Severity sets the order used for the &ldquo;average&rdquo; summary (higher is worse). Deactivate an option instead of deleting it, so older reports keep their labels.
        </p>
      </div>
      {(['weather', 'wind'] as const).map((kind) => {
        const rows = options.filter((o) => o.kind === kind).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <section key={kind} aria-labelledby={`kind-${kind}`} className="space-y-3">
            <h2 id={`kind-${kind}`} className="text-lg font-bold">{TITLES[kind]}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((option, i) => (
                <li key={option.id}><OptionRow option={option} isFirst={i === 0} isLast={i === rows.length - 1} /></li>
              ))}
            </ul>
            <div className="rounded-xl border border-dashed p-3">
              <p className="mb-2 text-sm font-bold">Add {kind} option</p>
              <OptionForm kind={kind} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
