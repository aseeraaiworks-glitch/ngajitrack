import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedProfile } from '@/domain/auth';

export async function ownProfile(client: SupabaseClient, authUserId: string): Promise<AuthenticatedProfile | null> {
  // Explicit identity filter in addition to RLS; profiles.id is NOT auth.users.id.
  const { data, error } = await client.from('profiles')
    .select('id, full_name, preferred_name')
    .eq('auth_user_id', authUserId).eq('is_active', true).is('deleted_at', null).maybeSingle();
  if (error) throw new Error('Profile could not be loaded.');
  return data ? { id: data.id, fullName: data.full_name, preferredName: data.preferred_name } : null;
}
