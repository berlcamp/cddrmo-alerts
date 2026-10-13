'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { getSettings } from '@/lib/data/admin';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { POPUP_ALT_MAX, settingsSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';
const BUCKET = 'cdrrmo-assets';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_POPUP_BYTES = 2 * 1024 * 1024;

const LOAD_FAILED = "Couldn't load the current settings. Try again.";

/** getSettings throws on a Supabase error; actions must return a result instead of throwing. */
async function loadSettings() {
  try {
    return await getSettings();
  } catch {
    return null;
  }
}

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const parsed = settingsSchema.safeParse({
    office_title: formData.get('office_title'),
    office_lines: String(formData.get('office_lines') ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
    network_name: formData.get('network_name'),
    call_sign: formData.get('call_sign'),
    radio_frequency: formData.get('radio_frequency'),
    report_title: formData.get('report_title'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const { error } = await cdrrmo(await createClient()).from('settings').update(parsed.data).eq('id', 1);
  if (error) return fail(`Could not save: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}

/** Removes a file this app uploaded to the assets bucket; other URLs are left alone. */
async function removeStoredFile(supabase: Awaited<ReturnType<typeof createClient>>, url: string | null) {
  const path = url?.split(PUBLIC_MARKER)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

/** Saves the pop-up image's description and, when a file is chosen, replaces the image. */
export async function savePopupImage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const alt = String(formData.get('popup_image_alt') ?? '').trim();
  if (alt.length > POPUP_ALT_MAX) return fail(`Keep the description under ${POPUP_ALT_MAX} characters.`);
  const file = formData.get('popup_image');
  const hasFile = file instanceof File && file.size > 0;
  const settings = await loadSettings();
  if (!settings) return fail(LOAD_FAILED, true);
  if (!hasFile && !settings.popup_image_url) return fail('Choose an image file.');

  const supabase = await createClient();
  let url = settings.popup_image_url;
  if (hasFile) {
    const ext = EXTENSIONS[file.type];
    if (!ext) return fail('Use a PNG, JPG or WebP image.');
    if (file.size > MAX_POPUP_BYTES) return fail('The image must be 2 MB or smaller.');
    const path = `popup/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (uploadError) return fail(`Upload failed: ${uploadError.message}`, true);
    url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const { error } = await cdrrmo(supabase).from('settings').update({ popup_image_url: url, popup_image_alt: alt }).eq('id', 1);
  if (error) return fail(`Could not save the image: ${error.message}`, true);
  if (hasFile) await removeStoredFile(supabase, settings.popup_image_url);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function removePopupImage(): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const settings = await loadSettings();
  if (!settings) return fail(LOAD_FAILED, true);
  const supabase = await createClient();
  const { error } = await cdrrmo(supabase).from('settings').update({ popup_image_url: null, popup_image_alt: '' }).eq('id', 1);
  if (error) return fail(`Could not remove: ${error.message}`, true);
  await removeStoredFile(supabase, settings.popup_image_url);
  revalidatePath('/', 'layout');
  return ok(null);
}
