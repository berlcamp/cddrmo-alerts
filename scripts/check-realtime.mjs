// Usage: node --env-file=.env.local scripts/check-realtime.mjs <reportId>
// Subscribes like a public visitor (anon key) on the private, read-only channel. Exits 0 when an `entry` broadcast arrives.
import { createClient } from '@supabase/supabase-js';

const [reportId] = process.argv.slice(2);
if (!reportId) {
  console.error('usage: node --env-file=.env.local scripts/check-realtime.mjs <reportId>');
  process.exit(2);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const timer = setTimeout(() => {
  console.error('FAIL: no entry broadcast within 90s');
  process.exit(1);
}, 90_000);

supabase
  .channel(`cdrrmo:report:${reportId}`, { config: { private: true } })
  .on('broadcast', { event: 'entry' }, ({ payload }) => {
    console.log('RECEIVED entry', payload.id, JSON.stringify(payload.remarks));
    clearTimeout(timer);
    process.exit(0);
  })
  .subscribe((status) => console.log('channel status:', status));
