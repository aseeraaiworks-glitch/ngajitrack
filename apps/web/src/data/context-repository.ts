import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BootstrapSources, Membership, LeadershipScope } from '@/domain/application-context';

export async function contextSources(client: SupabaseClient, profileId: string): Promise<BootstrapSources> {
  const institutionsResult = await client.rpc('my_institutions');
  if (institutionsResult.error) throw new Error('Context institutions unavailable.');
  const institutions = (institutionsResult.data ?? []) as BootstrapSources['institutions'];
  if (!institutions.length) return { institutions, memberships: [], scopes: [], programs: [] };
  const membershipsResult = await client.from('institution_members')
    .select('id, institution_id, profile_id, status, joined_at, ended_at, deleted_at, role:roles!inner(code,name)')
    .eq('profile_id', profileId).in('institution_id', institutions.map(i => i.id))
    .eq('status', 'ACTIVE').is('deleted_at', null).is('ended_at', null)
    .or('joined_at.is.null,joined_at.lte.' + new Date().toISOString());
  if (membershipsResult.error) throw new Error('Context memberships unavailable.');
  const memberships = (membershipsResult.data ?? []) as unknown as Membership[];
  const leaders = memberships.filter(m => ['MUDIR', 'WAKIL_MUDIR'].includes(m.role.code));
  let scopes: LeadershipScope[] = [];
  if (leaders.length) {
    const result = await client.rpc('my_leadership_scopes');
    if (result.error) throw new Error('Leadership scopes unavailable.');
    scopes = ((result.data ?? []) as LeadershipScope[]).filter(s =>
      leaders.some(m => m.id === s.membership_id && m.institution_id === s.institution_id && m.role.code === s.role_code));
  }
  const ids = [...new Set(scopes.flatMap(s => s.scope_type === 'PROGRAM' && s.program_id ? [s.program_id] : []))];
  let programs: BootstrapSources['programs'] = [];
  if (ids.length) {
    // Only metadata for programs referenced by the caller's own scope, never a roster/union business query.
    const result = await client.from('programs').select('id,institution_id,name')
      .in('id', ids).in('institution_id', institutions.map(i => i.id)).eq('is_active', true).is('deleted_at', null);
    if (result.error) throw new Error('Scoped programs unavailable.');
    programs = result.data ?? [];
  }
  return { institutions, memberships, scopes, programs };
}
