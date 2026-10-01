import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContexts, resolveContext, contextKey, contextPath, selectionDecision, sameContextScope, type BootstrapSources } from '../../src/domain/application-context.ts';
import { LatestRequest } from '../../src/application/latest-request.ts';
import { contextReducer, emptyContext } from '../../src/domain/session-context.ts';

function contexts() {
  const s: BootstrapSources = { institutions: [{ id: 'a', name: 'A' }], memberships: [{ id: 'm', institution_id: 'a', profile_id: 'own',
    status: 'ACTIVE', joined_at: null, ended_at: null, deleted_at: null, role: { code: 'WAKIL_MUDIR', name: 'Wakil Mudir' } }],
    scopes: ['p','q'].map(id => ({ scope_id: id, membership_id: 'm', institution_id: 'a', role_code: 'WAKIL_MUDIR', scope_type: 'PROGRAM', program_id: id, expires_at: null })),
    programs: ['p','q'].map(id => ({ id, institution_id: 'a', name: 'Program ' + id })) };
  return buildContexts(s, 'own', Date.now());
}
test('program focus narrows IDs, scope records and labels, without mutating bootstrap', () => {
  const all = contexts(), focused = resolveContext(all, { institutionId: 'a', membershipId: 'm', programId: 'q' })!;
  assert.deepEqual(focused.programScopeIds, ['q']); assert.deepEqual(focused.programLabels, ['Program q']);
  assert.equal(focused.leadershipScopes.length, 1); assert.equal(focused.leadershipScopes[0].program_id, 'q');
  assert.deepEqual(all[0].programScopeIds, ['p','q']);
  assert.equal(focused.presentation.queryIntent, 'scoped-monitoring');
});
test('unassigned, empty and cross-tenant program focuses fail closed', () => {
  for (const reference of [
    { institutionId: 'b', membershipId: 'm', programId: 'p' },
    { institutionId: 'a', membershipId: 'foreign', programId: 'p' },
    { institutionId: 'a', membershipId: 'm', programId: 'foreign' },
    { institutionId: 'a', membershipId: 'm', programId: '' },
  ]) assert.equal(resolveContext(contexts(), reference), null);
});
test('program URL cannot turn a relationship or institution context into a scoped role', () => {
  for (const scopeKind of ['RELATIONSHIP','INSTITUTION'] as const) {
    const all = contexts(); all[0].scopeKind = scopeKind;
    assert.equal(resolveContext(all, { institutionId: 'a', membershipId: 'm', programId: 'p' }), null);
  }
});
test('program context gets separate state generation and safe encoded route', () => {
  const a = resolveContext(contexts(), { institutionId: 'a', membershipId: 'm', programId: 'p' })!;
  const b = resolveContext(contexts(), { institutionId: 'a', membershipId: 'm', programId: 'q' })!;
  let state = contextReducer({ ...emptyContext, userId: 'own' }, { type: 'context', key: contextKey(a) });
  const generation = state.generation;
  state = contextReducer(state, { type: 'resolved', generation, data: { program: 'p' } });
  state = contextReducer(state, { type: 'context', key: contextKey(b) });
  assert.deepEqual(state.data, {});
  assert.equal(contextReducer(state, { type: 'resolved', generation, data: { program: 'p' } }), state);
  assert.equal(contextPath({ institutionId: 'a', membershipId: 'm', programId: 'p?evil=1' }), '/app/i/a/as/m?program=p%3Fevil%3D1');
});
test('preference focus is revalidated, retained on single membership, invalid focus forces choice', () => {
  const reference = { institutionId: 'a', membershipId: 'm', programId: 'q' };
  assert.equal(selectionDecision(contexts(), JSON.stringify(reference)).automatic?.programId, 'q');
  for (const programId of ['foreign', '', null, ['p']]) {
    const decision = selectionDecision(contexts(), JSON.stringify({ ...reference, programId }));
    assert.equal(decision.invalidPreference, true); assert.equal(decision.automatic, null);
  }
});
test('scope order changes do not invalidate presentation but revocation and expiry changes do', () => {
  const a = contexts()[0], b = structuredClone(a);
  b.leadershipScopes.reverse(); b.programScopeIds.reverse(); assert.ok(sameContextScope(a, b));
  b.leadershipScopes[0].expires_at = '2030-01-01'; assert.equal(sameContextScope(a, b), false);
  b.leadershipScopes.shift(); assert.equal(sameContextScope(a, b), false);
});
test('new request aborts earlier transport and rejects its late result even when transport ignores abort', async () => {
  const requests = new LatestRequest();
  const first = requests.begin();
  let release!: () => void;
  const slow = new Promise<void>(resolve => { release = resolve; });
  const results: string[] = [];
  const firstResult = slow.then(() => { if (first.current()) results.push('old-mode'); });
  const second = requests.begin();
  assert.equal(first.signal.aborted, true);
  if (second.current()) results.push('current-mode');
  release(); await firstResult;
  assert.deepEqual(results, ['current-mode']);
});
test('cancel/unmount rejects a previously completed response before it can update UI', () => {
  const requests = new LatestRequest(), response = requests.begin();
  assert.equal(response.current(), true); requests.cancel();
  assert.equal(response.current(), false); assert.equal(response.signal.aborted, true);
});
