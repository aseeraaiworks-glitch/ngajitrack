import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeDestination, loginError } from '../../src/domain/auth.ts';
import { contextReducer, emptyContext } from '../../src/domain/session-context.ts';
import { validatePublicEnvironment } from '../../src/lib/environment.ts';

test('redirect accepts only the implemented internal destination', () => {
  for (const value of ['/app', undefined, ['https://example.org'], '//example.org', '/\\example.org', '%2f%2fexample.org', 'https://example.org', '/app?next=https://example.org', 'javascript:alert(1)', '/app/../evil']) {
    assert.equal(safeDestination(value), '/app');
  }
});
test('login errors do not disclose server details or account existence', () => {
  assert.equal(loginError(400), loginError(401));
  assert.match(loginError(429), /Terlalu banyak/);
  assert.match(loginError(500), /belum dapat/);
});
test('environment fails closed for missing or private/JWT keys', () => {
  for (const key of [undefined, 'sb_secret_test-only', 'eyJ.invalid.signature']) {
    assert.throws(() => validatePublicEnvironment('https://example.supabase.co', key));
  }
});
test('environment rejects external HTTP, credentials and URL path/query', () => {
  for (const url of ['http://example.org', 'https://user@example.org', 'https://example.org/rest/v1', 'https://example.org?key=x']) {
    assert.throws(() => validatePublicEnvironment(url, 'sb_publishable_unit_test'));
  }
  assert.equal(validatePublicEnvironment('http://127.0.0.1:54321', 'sb_publishable_unit_test').url, 'http://127.0.0.1:54321');
});

function loadedContext() {
  let state = contextReducer(emptyContext, { type: 'session', userId: 'account-a' });
  state = contextReducer(state, { type: 'context', key: 'tenant-a:mudir' });
  return contextReducer(state, { type: 'resolved', generation: state.generation, data: { monitoring: ['private-a'] } });
}
test('acceptance: switching Mudir to Wali discards previous-mode data before loading', () => {
  const state = loadedContext();
  const next = contextReducer(state, { type: 'context', key: 'tenant-a:wali' });
  assert.deepEqual(next.data, {});
  assert.equal(next.userId, 'account-a');
  assert.ok(next.generation > state.generation);
});
test('acceptance: delayed response from previous mode cannot repopulate current mode', () => {
  const old = loadedContext();
  const current = contextReducer(old, { type: 'context', key: 'tenant-a:wali' });
  assert.deepEqual(contextReducer(current, { type: 'resolved', generation: old.generation, data: old.data }), current);
});
test('acceptance: switching institution clears previous institution data', () => {
  assert.deepEqual(contextReducer(loadedContext(), { type: 'context', key: 'tenant-b:mudir' }).data, {});
});
test('account change resets selected context and its data', () => {
  const state = contextReducer(loadedContext(), { type: 'session', userId: 'account-b' });
  assert.equal(state.contextKey, null);
  assert.deepEqual(state.data, {});
});
test('logout clears local presentation state and rejects late data', () => {
  const old = loadedContext();
  const state = contextReducer(old, { type: 'clear' });
  assert.equal(state.userId, null);
  assert.equal(state.contextKey, null);
  assert.deepEqual(state.data, {});
  assert.deepEqual(contextReducer(state, { type: 'resolved', generation: old.generation, data: old.data }), state);
});
test('token refresh for same account preserves current context', () => {
  const state = loadedContext();
  assert.equal(contextReducer(state, { type: 'session', userId: state.userId }), state);
});
test('data cannot load without an authenticated account and explicit context', () => {
  assert.deepEqual(contextReducer(emptyContext, { type: 'resolved', generation: 0, data: { leak: true } }), emptyContext);
  const state = contextReducer(emptyContext, { type: 'session', userId: 'account-a' });
  assert.deepEqual(contextReducer(state, { type: 'resolved', generation: state.generation, data: { leak: true } }), state);
});
