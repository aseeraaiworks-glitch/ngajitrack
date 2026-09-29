import 'server-only';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { ownProfile } from '@/data/profile-repository';

export async function authenticatedAccount() {
  const client = await serverClient();
  // Verify with Auth on every protected data load; RLS and JWT lifetime still apply.
  const { data: { user }, error } = await client.auth.getUser();
  if (error && (!error.status || error.status >= 500)) throw new Error('Authentication service unavailable.');
  if (!user) redirect('/login?next=%2Fapp');
  const profile = await ownProfile(client, user.id);
  return { userId: user.id, profile };
}
