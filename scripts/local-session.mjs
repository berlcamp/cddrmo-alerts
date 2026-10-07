// LOCAL ONLY: creates a local Supabase auth user and writes a Playwright storageState.
// Usage: LOCAL_SERVICE_ROLE_KEY=... node --env-file=.env.local scripts/local-session.mjs <email> <out.json>
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { writeFileSync } from 'node:fs';

const PASSWORD = 'local-only-password-1234';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
  console.error('Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not a local URL.');
  process.exit(1);
}
const serviceKey = process.env.LOCAL_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const [email, out] = process.argv.slice(2);
if (!serviceKey || !anonKey || !email || !out) {
  console.error('Need LOCAL_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, <email>, <out.json>.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
if (created.error && !/already|registered|exists/i.test(created.error.message)) {
  console.error(created.error.message);
  process.exit(1);
}

const jar = new Map();
const supabase = createServerClient(url, anonKey, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
});
const { data, error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
if (error) {
  console.error(error.message);
  process.exit(1);
}
const cookies = [...jar].map(([name, value]) => ({
  name, value, domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax',
}));
writeFileSync(out, JSON.stringify({ cookies, origins: [] }));
console.log(data.user.id);
