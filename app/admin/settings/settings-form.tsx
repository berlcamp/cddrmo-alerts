'use client';

import { Trash2, Upload } from 'lucide-react';
import { useActionState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ActionResult } from '@/lib/action-result';
import type { Settings } from '@/lib/types';
import { removeLogo, saveSettings, uploadLogo } from './actions';

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveSettings(prev, formData);
    if (result.ok) toast.success('Settings saved');
    return result;
  }, null);
  const [logoState, logoAction, uploading] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await uploadLogo(prev, formData);
    if (result.ok) toast.success('Logo added');
    return result;
  }, null);
  const [removing, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Report header</h1>
      <form action={formAction} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <FormField label="Office title" htmlFor="office_title">
          <Input id="office_title" name="office_title" defaultValue={settings.office_title} required className="h-11" />
        </FormField>
        <FormField label="Report title" htmlFor="report_title">
          <Input id="report_title" name="report_title" defaultValue={settings.report_title} required className="h-11" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Office lines" htmlFor="office_lines" hint="One line per row.">
            <Textarea id="office_lines" name="office_lines" rows={3} defaultValue={settings.office_lines.join('\n')} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Network name" htmlFor="network_name">
            <Input id="network_name" name="network_name" defaultValue={settings.network_name} required className="h-11" />
          </FormField>
        </div>
        <FormField label="Call sign" htmlFor="call_sign">
          <Input id="call_sign" name="call_sign" defaultValue={settings.call_sign} required className="h-11" />
        </FormField>
        <FormField label="Radio frequency" htmlFor="radio_frequency">
          <Input id="radio_frequency" name="radio_frequency" defaultValue={settings.radio_frequency} required className="h-11" />
        </FormField>
        {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2">{state.message}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Saving…' : 'Save header'}</Button>
        </div>
      </form>

      <section aria-labelledby="logos-heading" className="space-y-4 rounded-xl border bg-card p-4">
        <h2 id="logos-heading" className="text-lg font-bold">Logos</h2>
        <p className="text-sm text-muted-foreground">Shown in the public header, left to right. PNG, JPG or WebP, up to 500 KB, maximum 4.</p>
        <ul className="flex flex-wrap gap-4">
          {settings.logo_urls.map((url) => (
            <li key={url} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote logo from the public storage bucket */}
              <img src={url} alt="Logo" width={64} height={64} className="size-16 rounded-full border bg-white object-contain" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer text-danger"
                disabled={removing}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const result = await removeLogo(url);
                      if (!result.ok) toast.error(result.message);
                    } catch {
                      toast.error("Couldn't remove the logo. Check your connection and try again.");
                    }
                  })
                }
              >
                <Trash2 aria-hidden /> Remove
              </Button>
            </li>
          ))}
        </ul>
        <form action={logoAction} className="flex flex-wrap items-end gap-3">
          <FormField label="Add a logo" htmlFor="logo">
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="h-11" />
          </FormField>
          <Button type="submit" disabled={uploading} className="h-11 cursor-pointer"><Upload aria-hidden /> {uploading ? 'Uploading…' : 'Upload'}</Button>
          {logoState && !logoState.ok && <p role="alert" className="w-full text-sm font-bold text-danger">{logoState.message}</p>}
        </form>
      </section>
    </div>
  );
}
