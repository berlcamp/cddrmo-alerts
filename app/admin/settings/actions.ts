'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/lib/action-result';
import { getCurrentStaff } from '@/lib/auth';
import { getSettings } from '@/lib/data/admin';
import { cdrrmo } from '@/lib/supabase/db';
import { createClient } from '@/lib/supabase/server';
import { settingsSchema } from '@/lib/validation';

const NOT_ALLOWED = 'Your session has expired. Sign in again.';
const BUCKET = 'cdrrmo-assets';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_LOGOS = 4;
const MAX_BYTES = 500 * 1024;

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

export async function uploadLogo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image file.');
  const ext = EXTENSIONS[file.type];
  if (!ext) return fail('Use a PNG, JPG or WebP image.');
  if (file.size > MAX_BYTES) return fail('The logo must be 500 KB or smaller.');
  const settings = await loadSettings();
  if (!settings) return fail(LOAD_FAILED, true);
  if (settings.logo_urls.length >= MAX_LOGOS) return fail(`Remove a logo first (maximum ${MAX_LOGOS}).`);

  const supabase = await createClient();
  const path = `logos/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (uploadError) return fail(`Upload failed: ${uploadError.message}`, true);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await cdrrmo(supabase).from('settings').update({ logo_urls: [...settings.logo_urls, data.publicUrl] }).eq('id', 1);
  if (error) return fail(`Could not save the logo: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}

export async function removeLogo(url: string): Promise<ActionResult> {
  if (!(await getCurrentStaff())) return fail(NOT_ALLOWED);
  const settings = await loadSettings();
  if (!settings) return fail(LOAD_FAILED, true);
  if (!settings.logo_urls.includes(url)) return fail('Logo not found.');
  const supabase = await createClient();
  const path = url.split(PUBLIC_MARKER)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await cdrrmo(supabase).from('settings').update({ logo_urls: settings.logo_urls.filter((u) => u !== url) }).eq('id', 1);
  if (error) return fail(`Could not remove: ${error.message}`, true);
  revalidatePath('/', 'layout');
  return ok(null);
}
