import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContexts, findContext, selectionDecision, type BootstrapSources } from '../../src/domain/application-context.ts';
const now = Date.parse('2026-10-01T12:00:00Z');
function fixture(role = 'GUARDIAN'): BootstrapSources {
  return { institutions: [{ id: 'a', name: 'Lembaga A' }], memberships: [{
    id: 'member', institution_id: 'a', profile_id: 'own', status: 'ACTIVE', joined_at: null, ended_at: null, deleted_at: null, role: { code: role, name: role },
  }], scopes: [], programs: [] };
}
function scope(s: BootstrapSources, program: string | null, expiry: string | null = null) {
  s.scopes.push({ scope_id: 'scope-' + (program ?? 'institution'), membership_id: 'member', institution_id: 'a',
    role_code: s.memberships[0].role.code, scope_type: program ? 'PROGRAM' : 'INSTITUTION', program_id: program, expires_at: expiry });
  if (program) s.programs.push({ id: program, institution_id: 'a', name: program });
}
const build = (s: BootstrapSources) => buildContexts(s, 'own', now);
test('zero institutions yields no context even with arbitrary membership input', () => {
  const s = fixture(); s.institutions = []; assert.deepEqual(build(s), []);
});
test('one institution and one role has exactly one context', () => {
  const result = build(fixture()); assert.equal(result.length, 1); assert.equal(result[0].roleCode, 'GUARDIAN');
  assert.equal(result[0].presentation.queryIntent, 'guardian-relationships');
});
test('same account has contexts in multiple institutions', () => {
  const s = fixture(); s.institutions.push({ id: 'b', name: 'Lembaga B' });
  s.memberships.push({ ...s.memberships[0], id: 'member-b', institution_id: 'b' });
  assert.equal(build(s).length, 2);
});
test('Mudir plus Wali remains two memberships and two query intents', () => {
  const s = fixture('MUDIR'); scope(s, null);
  s.memberships.push({ ...s.memberships[0], id: 'guardian', role: { code: 'GUARDIAN', name: 'Wali' } });
  const result = build(s); assert.equal(result.length, 2);
  assert.deepEqual(new Set(result.map(c => c.presentation.queryIntent)), new Set(['institution-monitoring', 'guardian-relationships']));
  assert.equal(result.find(c => c.roleCode === 'GUARDIAN')?.leadershipScopes.length, 0);
});
test('Mudir without institution scope is not selectable', () => {
  const s = fixture('MUDIR'); scope(s, 'p'); assert.deepEqual(build(s), []);
});
test('deputy one scope has explicit program IDs', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, 'p');
  assert.deepEqual(build(s)[0].programScopeIds, ['p']); assert.equal(build(s)[0].scopeKind, 'PROGRAMS');
});
test('deputy multiple scopes aggregate only within its own membership', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, 'p'); scope(s, 'q');
  assert.equal(build(s).length, 1); assert.deepEqual(build(s)[0].programScopeIds, ['p','q']);
});
test('deputy institution scope is supported explicitly', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, null); assert.equal(build(s)[0].scopeKind, 'INSTITUTION');
});
test('missing/revoked scopes returned as empty cannot imply full access', () => {
  assert.deepEqual(build(fixture('WAKIL_MUDIR')), []);
});
test('scope expiry at boundary is excluded and future expiry is retained', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, 'p', new Date(now).toISOString()); assert.deepEqual(build(s), []);
  s.scopes[0].expires_at = new Date(now + 1000).toISOString();
  assert.equal(build(s)[0].revalidateAt, s.scopes[0].expires_at);
});
test('inactive program omitted from active program lookup invalidates that scope', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, 'p'); s.programs = []; assert.deepEqual(build(s), []);
});
test('partial program revocation does not remove other valid scope', () => {
  const s = fixture('WAKIL_MUDIR'); scope(s, 'p'); scope(s, 'q'); s.scopes.shift();
  assert.deepEqual(build(s)[0].programScopeIds, ['q']);
});
test('wrong profile/inactive/deleted/ended/future membership excluded', () => {
  for (const change of [{ profile_id: 'other' }, { status: 'INACTIVE' }, { deleted_at: '2026-01-01' }, { ended_at: '2026-01-01' }, { joined_at: '2099-01-01' }]) {
    const s = fixture(); Object.assign(s.memberships[0], change); assert.deepEqual(build(s), []);
  }
});
test('cross-tenant scope and wrong membership cannot expand context', () => {
  for (const change of [{ institution_id: 'b' }, { membership_id: 'other' }, { role_code: 'MUDIR' }]) {
    const s = fixture('WAKIL_MUDIR'); scope(s, 'p'); Object.assign(s.scopes[0], change); assert.deepEqual(build(s), []);
  }
});
test('single context can be selected automatically', () => {
  const contexts = build(fixture()); assert.equal(selectionDecision(contexts, null).automatic, contexts[0]);
});
test('valid preference is only preselection when multiple contexts exist', () => {
  const contexts = build(fixture()); contexts.push({ ...contexts[0], membershipId: 'two' });
  const decision = selectionDecision(contexts, JSON.stringify({ institutionId: 'a', membershipId: 'two', roleCode: 'MUDIR' }));
  assert.equal(decision.automatic, null); assert.equal(decision.preferred?.membershipId, 'two'); assert.equal(decision.preferred?.roleCode, 'GUARDIAN');
});
test('invalid preference requires explicit selection even with one remaining context', () => {
  for (const stored of ['{bad', 'null', '{}', JSON.stringify({ institutionId: 'a', membershipId: 'foreign' })]) {
    const decision = selectionDecision(build(fixture()), stored);
    assert.equal(decision.invalidPreference, true); assert.equal(decision.automatic, null);
  }
});
test('deep link must match institution AND membership, never a role label', () => {
  const contexts = build(fixture());
  assert.ok(findContext(contexts, 'a', 'member')); assert.equal(findContext(contexts, 'b', 'member'), null);
  assert.equal(findContext(contexts, 'a', 'MUDIR'), null);
});
test('unknown and platform-only roles do not become institution contexts', () => {
  assert.deepEqual(build(fixture('SUPER_ADMIN')), []); assert.deepEqual(build(fixture('FUTURE_ROLE')), []);
});
test('presentation metadata does not grant approval or backend permission', () => {
  const s = fixture('MUDIR'); scope(s, null);
  assert.deepEqual(build(s)[0].presentation, { queryIntent: 'institution-monitoring', landing: 'context-summary' });
});
