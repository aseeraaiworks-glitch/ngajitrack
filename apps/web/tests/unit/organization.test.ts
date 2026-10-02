import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseMutation, databaseError, canManageStructure, structureErrors } from '../../src/domain/organization.ts';
import { buildContexts } from '../../src/domain/application-context.ts';
import { navigationFor } from '../../src/domain/navigation.ts';
import { sameOriginWrite } from '../../src/domain/request-origin.ts';
const id = randomUUID();
const create = { entity: 'program', values: { name: 'Reguler', description: null, program_type_id: id } };
test('CSRF checks exact public host, scheme and origin; never forwarded host or missing origin', () => {
  const request = (origin: string, host = 'app.example.invalid', forwarded = 'evil.invalid') => ({ url: 'https://internal:3000/structure/data', headers: new Headers({ origin, host, 'x-forwarded-host': forwarded }) });
  assert.equal(sameOriginWrite(request('https://app.example.invalid')), true);
  for (const origin of ['', 'null', 'https://evil.invalid', 'https://app.example.invalid.evil.invalid', 'http://app.example.invalid', 'https://app.example.invalid/path', 'https://user@app.example.invalid', 'https://app.example.invalid:444']) assert.equal(sameOriginWrite(request(origin)), false);
  assert.equal(sameOriginWrite({ url: 'http://internal:3000/', headers: new Headers({ origin: 'http://127.0.0.1:54300', host: '127.0.0.1:54300' }) }), true);
});
test('organization writes accept only an exact field allowlist, not tenant or ownership input', () => {
  assert.ok(parseMutation(create));
  for (const column of ['institution_id', 'created_by', 'deleted_at', 'id', 'metadata']) {
    assert.equal(parseMutation({ ...create, values: { ...create.values, [column]: id } }), null);
    assert.equal(parseMutation({ ...create, [column]: id }), null);
  }
  assert.equal(parseMutation({ ...create, values: { ...create.values, name: ' ' } }), null);
  assert.equal(parseMutation({ ...create, values: { ...create.values, program_type_id: 'untrusted' } }), null);
});
test('stale update tokens are mandatory and limited to the applicable entity', () => {
  const values = { name: 'Program', description: null, is_active: false };
  assert.equal(parseMutation({ entity: 'program', id, values }), null);
  assert.ok(parseMutation({ entity: 'program', id, values, expected: { updated_at: new Date().toISOString() } }));
  assert.equal(parseMutation({ entity: 'program', id, values, expected: { updated_at: 'bad', institution_id: id } }), null);
  assert.equal(parseMutation({ entity: 'group', id, values: { name: 'A', program_id: id, program_level_id: null, is_active: true, status: 'ACTIVE' }, expected: { updated_at: new Date().toISOString(), program_level_id: null } }), null);
});
test('level codes, ordering, blank names, and invalid scalar types are rejected', () => {
  const values = { name: 'Tingkat 1', code: 'CUSTOM_1', sort_order: 2, is_active: true };
  assert.ok(parseMutation({ entity: 'level', values }));
  for (const patch of [{ code: '' }, { code: 'a/b' }, { sort_order: -1 }, { sort_order: 1.2 }, { sort_order: '2' }, { is_active: 'true' }, { name: '' }]) {
    assert.equal(parseMutation({ entity: 'level', values: { ...values, ...patch } }), null);
  }
});
test('class allows explicit legacy no-level but not arbitrary program or relation IDs', () => {
  assert.ok(parseMutation({ entity: 'group', values: { name: 'Kelas', program_id: id, program_level_id: null } }));
  assert.equal(parseMutation({ entity: 'group', values: { name: 'Kelas', program_id: null, program_level_id: null } }), null);
  assert.equal(parseMutation({ entity: 'relation', values: { program_id: id, level_id: 'wrong' } }), null);
  assert.ok(parseMutation({ entity: 'relation', id, values: { is_active: false }, expected: { is_active: true } }));
});
test('admin presentation is explicit and is never inherited from another role', () => {
  for (const role of ['INSTITUTION_ADMIN', 'GUARDIAN', 'TEACHER', 'STUDENT']) {
    const [context] = buildContexts({ institutions: [{ id, name: 'Institution' }], programs: [], scopes: [], memberships: [
      { id, institution_id: id, profile_id: id, role: { code: role, name: role }, status: 'ACTIVE', joined_at: null, ended_at: null, deleted_at: null },
    ] }, id, Date.now());
    assert.equal(canManageStructure(context), role === 'INSTITUTION_ADMIN');
    const pathname = '/app/i/' + id + '/as/' + id + '/structure';
    assert.equal(navigationFor(context, true, pathname).some(item => item.current), role === 'INSTITUTION_ADMIN');
    assert.equal(canManageStructure({ ...context, roleCode: 'MUDIR' }), false);
    assert.equal(canManageStructure({ ...context, roleCode: 'WAKIL_MUDIR' }), false);
  }
});
test('database codes map to generic expected business errors, never raw server messages', () => {
  for (const [code, error] of Object.entries({ '42501': 'denied', '23503': 'relationship', '23505': 'duplicate', '23514': 'rule', '22023': 'invalid', 'XX000': 'unavailable' })) assert.equal(databaseError(code), error);
  for (const message of Object.values(structureErrors)) assert.doesNotMatch(message, /PostgreSQL|constraint|SQLSTATE|uuid/i);
});
