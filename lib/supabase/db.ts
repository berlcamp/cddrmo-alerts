import type { SupabaseClient } from '@supabase/supabase-js';

export const SCHEMA = 'cdrrmo';

export function cdrrmo(client: SupabaseClient) {
  return client.schema(SCHEMA);
}
