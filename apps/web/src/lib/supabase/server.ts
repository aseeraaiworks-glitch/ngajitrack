import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnvironment } from '../environment';

export async function serverClient() {
  const store = await cookies();
  const { url, key } = publicEnvironment();
  return createServerClient(url, key, { cookies: {
    getAll: () => store.getAll(),
    setAll(values) {
      // Server Components cannot write cookies; proxy.ts refreshes them first.
      try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
      catch { /* Read-only render context. */ }
    },
  } });
}
