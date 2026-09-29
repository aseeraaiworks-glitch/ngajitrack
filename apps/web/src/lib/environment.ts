export function validatePublicEnvironment(url: string | undefined, key: string | undefined) {
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.');
  const parsed = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/' ||
      (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))) {
    throw new Error('Supabase URL must be an HTTPS origin (HTTP is allowed on loopback only).');
  }
  // This application deliberately accepts only the modern public key format.
  // Legacy JWT keys can accidentally carry service_role and must not be bundled.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('Only a Supabase publishable key is allowed in the web application.');
  }
  return { url: parsed.origin, key };
}

export function publicEnvironment() {
  return validatePublicEnvironment(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
