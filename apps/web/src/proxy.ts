import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnvironment } from './lib/environment';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = publicEnvironment();
  const supabase = createServerClient(url, key, { cookieOptions: {
    sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
  }, cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  await supabase.auth.getUser();
  // No shared cache may retain a session cookie or a user's server-rendered data.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = { matcher: ['/app/:path*', '/login'] };
