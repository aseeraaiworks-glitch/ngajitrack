export type Institution = { id: string; name: string };
export type Membership = {
  id: string; institution_id: string; profile_id: string; status: string;
  joined_at: string | null; ended_at: string | null; deleted_at: string | null;
  role: { code: string; name: string };
};
export type LeadershipScope = {
  scope_id: string; membership_id: string; institution_id: string; role_code: string;
  scope_type: 'INSTITUTION' | 'PROGRAM'; program_id: string | null; expires_at: string | null;
};
export type ScopedProgram = { id: string; institution_id: string; name: string };
export type QueryIntent = 'institution-operations' | 'institution-monitoring' | 'scoped-monitoring'
  | 'guardian-relationships' | 'teacher-assignments' | 'student-identity';
export type ApplicationContext = {
  institutionId: string; institutionName: string; membershipId: string;
  programId?: string;
  programs: { id: string; name: string }[];
  roleCode: string; roleLabel: string;
  leadershipScopes: LeadershipScope[];
  programScopeIds: string[];
  programLabels: string[];
  scopeKind: 'INSTITUTION' | 'PROGRAMS' | 'RELATIONSHIP';
  revalidateAt: string | null;
  // Presentation/navigation hints only: no backend grant, no approval entitlement.
  presentation: { queryIntent: QueryIntent; landing: 'context-summary' };
};
export type ContextReference = { institutionId: string; membershipId: string; programId?: string };
export type BootstrapSources = { institutions: Institution[]; memberships: Membership[]; scopes: LeadershipScope[]; programs: ScopedProgram[] };

const intents: Record<string, QueryIntent> = {
  INSTITUTION_ADMIN: 'institution-operations', MUDIR: 'institution-monitoring',
  WAKIL_MUDIR: 'scoped-monitoring', GUARDIAN: 'guardian-relationships',
  TEACHER: 'teacher-assignments', STUDENT: 'student-identity',
};
export function contextKey(context: ContextReference) {
  return context.institutionId + ':' + context.membershipId + (context.programId ? ':' + context.programId : '');
}
export function contextPath(context: ContextReference) {
  return '/app/i/' + encodeURIComponent(context.institutionId) + '/as/' + encodeURIComponent(context.membershipId) +
    (context.programId ? '?program=' + encodeURIComponent(context.programId) : '');
}
export function findContext(contexts: ApplicationContext[], institutionId: string, membershipId: string) {
  return contexts.find(c => c.institutionId === institutionId && c.membershipId === membershipId) ?? null;
}
// A program focus narrows an existing PROGRAMS context. It never supplies a grant.
export function resolveContext(contexts: ApplicationContext[], reference: ContextReference): ApplicationContext | null {
  const context = findContext(contexts, reference.institutionId, reference.membershipId);
  if (!context) return null;
  if (reference.programId === undefined) return context;
  const program = context.programs.find(p => p.id === reference.programId);
  if (context.scopeKind !== 'PROGRAMS' || !program || !context.programScopeIds.includes(program.id)) return null;
  return { ...context, programId: program.id, programs: [program], programScopeIds: [program.id], programLabels: [program.name],
    leadershipScopes: context.leadershipScopes.filter(s => s.program_id === program.id) };
}
export function sameContextScope(a: ApplicationContext, b: ApplicationContext) {
  const signature = (c: ApplicationContext) => JSON.stringify([contextKey(c), c.roleCode, c.scopeKind,
    [...c.programScopeIds].sort(), c.leadershipScopes.map(s => [s.scope_id, s.expires_at]).sort()]);
  return signature(a) === signature(b);
}
export function buildContexts(sources: BootstrapSources, profileId: string, now: number): ApplicationContext[] {
  const institutions = new Map(sources.institutions.map(i => [i.id, i]));
  const contexts: ApplicationContext[] = [];
  for (const member of sources.memberships) {
    const institution = institutions.get(member.institution_id);
    const role = member.role.code;
    if (!institution || member.profile_id !== profileId || member.status !== 'ACTIVE' ||
        member.deleted_at !== null || member.ended_at !== null ||
        (member.joined_at !== null && !(Date.parse(member.joined_at) <= now)) || !intents[role]) continue;
    const leadership = role === 'MUDIR' || role === 'WAKIL_MUDIR';
    // Revocation/start validity is enforced by my_leadership_scopes() in the DB.
    // Join its projection to this exact active membership, tenant, and active programs.
    const scopes = leadership ? sources.scopes.filter(scope =>
      scope.membership_id === member.id && scope.institution_id === institution.id && scope.role_code === role &&
      (scope.expires_at === null || Date.parse(scope.expires_at) > now) &&
      ((scope.scope_type === 'INSTITUTION' && scope.program_id === null) ||
       (role === 'WAKIL_MUDIR' && scope.scope_type === 'PROGRAM' && sources.programs.some(p =>
         p.id === scope.program_id && p.institution_id === institution.id)))) : [];
    if (leadership && !scopes.length) continue;
    const institutionScope = scopes.some(s => s.scope_type === 'INSTITUTION');
    const programScopeIds = [...new Set(scopes.flatMap(s => s.program_id ? [s.program_id] : []))].sort();
    const expiries = scopes.flatMap(s => s.expires_at ? [s.expires_at] : []).sort((a, b) => Date.parse(a) - Date.parse(b));
    contexts.push({
      institutionId: institution.id, institutionName: institution.name, membershipId: member.id,
      roleCode: role, roleLabel: member.role.name,
      leadershipScopes: scopes, programScopeIds,
      programs: sources.programs.filter(p => p.institution_id === institution.id && programScopeIds.includes(p.id)).map(p => ({ id: p.id, name: p.name })),
      programLabels: sources.programs.filter(p => p.institution_id === institution.id && programScopeIds.includes(p.id)).map(p => p.name),
      scopeKind: institutionScope || role === 'INSTITUTION_ADMIN' ? 'INSTITUTION' : leadership ? 'PROGRAMS' : 'RELATIONSHIP',
      revalidateAt: expiries[0] ?? null,
      presentation: { queryIntent: intents[role], landing: 'context-summary' },
    });
  }
  // Stable alphabetical presentation, never privilege ranking.
  return contexts.sort((a, b) => a.institutionName.localeCompare(b.institutionName, 'id') ||
    a.roleLabel.localeCompare(b.roleLabel, 'id') || a.membershipId.localeCompare(b.membershipId));
}
export function selectionDecision(contexts: ApplicationContext[], stored: string | null) {
  let preferred: ApplicationContext | null = null;
  let invalidPreference = false;
  if (stored !== null) {
    try {
      const value = JSON.parse(stored) as ContextReference | null;
      preferred = value && typeof value.institutionId === 'string' && typeof value.membershipId === 'string' &&
        (value.programId === undefined || typeof value.programId === 'string')
        ? resolveContext(contexts, value) : null;
    } catch { /* Invalid preference is discarded, never trusted. */ }
    invalidPreference = !preferred;
  }
  return { preferred, invalidPreference, automatic: contexts.length === 1 && !invalidPreference ? preferred ?? contexts[0] : null };
}
