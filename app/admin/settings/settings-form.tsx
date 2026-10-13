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
import { POPUP_ALT_MAX } from '@/lib/validation';
import { removePopupImage, savePopupImage, saveSettings } from './actions';

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await saveSettings(prev, formData);
    if (result.ok) toast.success('Settings saved');
    return result;
  }, null);
  const [popupState, popupAction, uploading] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await savePopupImage(prev, formData);
    if (result.ok) toast.success('Pop-up image saved');
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

      <section aria-labelledby="popup-heading" className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <h2 id="popup-heading" className="text-lg font-bold">Pop-up image</h2>
          <p className="text-sm text-muted-foreground">Opens in a pop-up on the public pages about 3 seconds after each visit or reload. PNG, JPG or WebP, up to 2 MB.</p>
        </div>
        {settings.popup_image_url ? (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote image from the public storage bucket */}
            <img src={settings.popup_image_url} alt={settings.popup_image_alt || 'Current pop-up image'} className="max-h-48 w-auto rounded-lg border bg-muted object-contain" />
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer text-danger hover:text-danger"
              disabled={removing}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const result = await removePopupImage();
                    if (result.ok) toast.success('Pop-up image removed');
                    else toast.error(result.message);
                  } catch {
                    toast.error("Couldn't remove the image. Check your connection and try again.");
                  }
                })
              }
            >
              <Trash2 aria-hidden /> {removing ? 'Removing…' : 'Remove pop-up'}
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No pop-up image. Visitors see no pop-up.</p>
        )}
        <form key={settings.popup_image_url ?? 'none'} action={popupAction} className="grid gap-4 sm:grid-cols-2">
          <FormField label={settings.popup_image_url ? 'Replace image' : 'Image'} htmlFor="popup_image">
            <Input id="popup_image" name="popup_image" type="file" accept="image/png,image/jpeg,image/webp" required={!settings.popup_image_url} className="h-11" />
          </FormField>
          <FormField label="Description" htmlFor="popup_image_alt" hint="What the image says, for screen readers and if it fails to load.">
            <Input id="popup_image_alt" name="popup_image_alt" maxLength={POPUP_ALT_MAX} defaultValue={settings.popup_image_alt} className="h-11" />
          </FormField>
          {popupState && !popupState.ok && <p role="alert" className="text-sm font-bold text-danger sm:col-span-2">{popupState.message}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={uploading} className="h-11 cursor-pointer"><Upload aria-hidden /> {uploading ? 'Saving…' : 'Save pop-up'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
