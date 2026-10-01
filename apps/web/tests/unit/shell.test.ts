import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { navigationFor } from '../../src/domain/navigation.ts';
import { buildContexts, resolveContext, type BootstrapSources } from '../../src/domain/application-context.ts';

function fixture() {
  const roles = ['MUDIR','WAKIL_MUDIR','GUARDIAN','TEACHER','STUDENT','INSTITUTION_ADMIN'];
  const s: BootstrapSources = { institutions: [{ id: 'a', name: 'A' }], programs: [{ id: 'p', institution_id: 'a', name: 'Program' }],
    memberships: roles.map(code => ({ id: code, institution_id: 'a', profile_id: 'own', status: 'ACTIVE', joined_at: null, ended_at: null, deleted_at: null, role: { code, name: code } })),
    scopes: [
      { scope_id: 'm', membership_id: 'MUDIR', institution_id: 'a', role_code: 'MUDIR', scope_type: 'INSTITUTION', program_id: null, expires_at: null },
      { scope_id: 'w', membership_id: 'WAKIL_MUDIR', institution_id: 'a', role_code: 'WAKIL_MUDIR', scope_type: 'PROGRAM', program_id: 'p', expires_at: null },
    ] };
  return buildContexts(s, 'own', Date.now());
}
test('each selected role has only its own presentation route, never the union of account roles', () => {
  const labels = ['Ruang kepemimpinan','Ruang kepemimpinan','Ruang wali','Ruang pengajaran','Ruang santri','Ruang administrasi'];
  for (const [i, role] of ['MUDIR','WAKIL_MUDIR','GUARDIAN','TEACHER','STUDENT','INSTITUTION_ADMIN'].entries()) {
    const items = navigationFor(fixture().find(c => c.roleCode === role)!);
    assert.equal(items.length, 2); assert.equal(items[0].label, labels[i]);
    assert.equal(items[0].href, '/app/i/a/as/' + role); assert.equal(items[1].href, '/app/select-context');
    assert.equal(items.filter(item => item.current).length, 1);
  }
});
test('program focus stays attached to scoped navigation and cannot become broad monitoring', () => {
  const context = resolveContext(fixture(), { institutionId: 'a', membershipId: 'WAKIL_MUDIR', programId: 'p' });
  assert.equal(navigationFor(context)[0].href, '/app/i/a/as/WAKIL_MUDIR?program=p');
  assert.deepEqual(context?.programScopeIds, ['p']);
});
test('missing, invalidated and unknown contexts do not render privileged navigation', () => {
  assert.deepEqual(navigationFor(null).map(i => i.href), ['/app/select-context']);
  assert.deepEqual(navigationFor(fixture()[0], false), []);
  assert.deepEqual(navigationFor({ ...fixture()[0], roleCode: 'UNSUPPORTED' }).map(i => i.href), ['/app/select-context']);
});

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(v => Number.parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
test('semantic text/status/button token pairs meet 4.5:1 in light and prepared dark palettes', () => {
  const css = readFileSync(new URL('../../src/styles/globals.css', import.meta.url), 'utf8');
  const blocks = [css.match(/:root\s*\{([^}]+)\}/)![1], css.match(/\[data-theme="dark"\]\s*\{([^}]+)\}/)![1]];
  for (const block of blocks) {
    const colors = Object.fromEntries([...block.matchAll(/--ngt-([\w-]+):\s*(#[a-f0-9]{6});/g)].map(match => [match[1], match[2]]));
    const pairs = [['ink','surface'],['muted','surface'],['ink','canvas'],['muted','canvas'],['brand','soft'],['on-brand','brand'],['on-brand','brand-hover'],
      ...['success','warning','danger','info'].map(tone => [tone, tone + '-soft'])];
    for (const [a,b] of pairs) {
      const values = [luminance(colors[a]), luminance(colors[b])].sort((a,b) => b-a);
      assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${a}/${b} text contrast`);
    }
  }
});
