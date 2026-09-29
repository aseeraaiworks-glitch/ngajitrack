'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnvironment } from '../environment';

export function browserClient() {
  const { url, key } = publicEnvironment();
  return createBrowserClient(url, key, { cookieOptions: {
    sameSite: 'lax', secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
  } });
}
