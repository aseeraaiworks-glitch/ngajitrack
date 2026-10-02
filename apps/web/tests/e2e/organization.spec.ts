import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Group, Level, Mutation, Program, Structure } from '../../src/domain/organization';
type Account = { id: string; email: string; profileId: string; memberships: { id: string; institution_id: string; code: string }[] };
const f = JSON.parse(process.env.NGT_WEB_CONTEXT_FIXTURE!) as { accounts: Record<string, Account>; institutions: { A: string; B: string }; programs: { a: string; other: string } };
const origin = process.env.NGT_WEB_TEST_URL!;
const id = () => randomUUID().slice(0, 8);
const path = (name = 'structureAdmin', role = 'INSTITUTION_ADMIN', tenant = f.institutions.A) => '/app/i/' + tenant + '/as/' + f.accounts[name].memberships.find(m => m.code === role && m.institution_id === tenant)!.id;
const endpoint = (tenant = f.institutions.A) => path('structureAdmin', 'INSTITUTION_ADMIN', tenant) + '/structure/data';
async function login(page: Page, name = 'structureAdmin') {
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(f.accounts[name].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.NGT_WEB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pilih konteks Anda' }).or(page.getByRole('button', { name: 'Ganti konteks', exact: true }))).toBeVisible();
}
async function enter(page: Page) { await login(page); await page.goto(path() + '/structure'); await expect(page.getByRole('button', { name: 'Tambah program', exact: true })).toBeVisible(); }
async function read(page: Page, tenant = f.institutions.A): Promise<Structure> { const r = await page.request.get(endpoint(tenant)); expect(r.status()).toBe(200); return r.json(); }
async function write(page: Page, data: Mutation, status = 200, url = endpoint()) {
  const r = await page.request.post(url, { data, headers: { Origin: origin } });
  const body = await r.json(); expect(r.status(), JSON.stringify(body)).toBe(status);
  if (status !== 200) expect(JSON.stringify(body)).not.toMatch(/SQLSTATE|constraint|public\.|PostgreSQL|[a-f0-9]{8}-[a-f0-9]{4}-/i);
  return body;
}
async function program(page: Page, tenant = f.institutions.A) {
  const name = 'M13 Program ' + id(), data = await read(page, tenant);
  await write(page, { entity: 'program', values: { name, description: null, program_type_id: data.learningTypes[0].id } }, 200, endpoint(tenant));
  return (await read(page, tenant)).programs.find(p => p.name === name)!;
}
async function level(page: Page, tenant = f.institutions.A) {
  const name = 'M13 Tingkat ' + id();
  await write(page, { entity: 'level', values: { name, code: 'L_' + id(), sort_order: 10, is_active: true } }, 200, endpoint(tenant));
  return (await read(page, tenant)).levels.find(l => l.name === name)!;
}
async function relation(page: Page, p: Program, l: Level) {
  await write(page, { entity: 'relation', values: { program_id: p.id, level_id: l.id } });
  return (await read(page)).relations.find(r => r.program_id === p.id && r.level_id === l.id)!;
}
const programEdit = (p: Program, name = p.name, active = p.is_active): Mutation => ({ entity: 'program', id: p.id, values: { name, description: p.description, is_active: active }, expected: { updated_at: p.updated_at } });
const groupEdit = (g: Group, changes: Mutation['values'] = {}): Mutation => ({ entity: 'group', id: g.id, values: { name: g.name, program_level_id: g.program_level_id, is_active: g.is_active, status: g.status, ...changes }, expected: { updated_at: g.updated_at, program_level_id: g.program_level_id } });
const levelEdit = (l: Level, changes: Mutation['values'] = {}): Mutation => ({ entity: 'level', id: l.id, values: { name: l.name, code: l.code, sort_order: l.sort_order, is_active: l.is_active, ...changes }, expected: { name: l.name, code: l.code, sort_order: l.sort_order, is_active: l.is_active } });
const tokens = new Map<string, string>();
async function rest(name: string, route: string, method = 'GET', data?: unknown) {
  if (!tokens.has(name)) {
    const auth = await fetch(process.env.NGT_WEB_TEST_AUTH_URL! + '/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: f.accounts[name].email, password: process.env.NGT_WEB_TEST_PASSWORD }) });
    expect(auth.status).toBe(200); tokens.set(name, (await auth.json()).access_token);
  }
  const response = await fetch(process.env.NGT_WEB_TEST_REST_URL! + route, { method, headers: { Authorization: 'Bearer ' + tokens.get(name), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: data ? JSON.stringify(data) : undefined });
  return { status: response.status, body: await response.json() };
}

test('admin manages a program through the UI, with explicit activation confirmation', async ({ page }) => {
  await enter(page); const name = 'M13 UI ' + id();
  await expect(page.getByRole('navigation', { name: 'Navigasi desktop' }).getByRole('link', { name: 'Struktur lembaga' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Tambah program', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Nama program', { exact: true }).fill(name);
  await dialog.getByLabel('Jenis pembelajaran utama').selectOption({ label: 'Tahfiz' });
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(row).toBeVisible(); await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByLabel('Deskripsi (opsional)').fill('Program organisasi yang dapat dikonfigurasi');
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(row).toContainText('Program organisasi yang dapat dikonfigurasi');
  await row.getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await expect(dialog).toContainText('Data tetap tersimpan'); await dialog.getByRole('button', { name: 'Konfirmasi' }).click();
  await expect(row.getByText('Nonaktif', { exact: true })).toBeVisible();
});

test('level, program relation, and class forms save selected values through the UI', async ({ page }) => {
  await enter(page); const p = await program(page), name = 'M13 UI Level ' + id(), code = 'UI_' + id(), className = 'M13 UI Class ' + id();
  await page.getByRole('button', { name: 'Tingkatan', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah tingkatan', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nama tingkatan', { exact: true }).fill(name); await dialog.getByLabel('Kode tingkatan', { exact: true }).fill(code); await dialog.getByLabel('Urutan', { exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Program', exact: true }).click();
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: p.name, exact: true }) });
  await row.getByRole('button', { name: 'Hubungkan tingkatan', exact: true }).click();
  await dialog.getByLabel('Tingkatan', { exact: true }).selectOption({ label: name + ' (' + code + ')' }); await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(row).toContainText(name + ' · Terhubung');
  await page.getByRole('button', { name: 'Kelas / Halaqah', exact: true }).click(); await page.getByRole('button', { name: 'Tambah kelas / halaqah', exact: true }).click();
  await dialog.getByLabel('Nama kelas / halaqah', { exact: true }).fill(className); await dialog.getByLabel('Program', { exact: true }).selectOption(p.id);
  await dialog.getByLabel('Tingkatan', { exact: true }).selectOption({ label: name }); await dialog.getByRole('button', { name: 'Simpan', exact: true }).click();
  const groupRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: className, exact: true }) });
  await expect(groupRow).toContainText(p.name + ' · ' + name); await groupRow.getByRole('button', { name: 'Nonaktifkan', exact: true }).click();
  await dialog.getByRole('button', { name: 'Konfirmasi', exact: true }).click(); await expect(groupRow.getByText('Nonaktif', { exact: true })).toBeVisible();
});

for (const [name, role] of [['outsider', 'MUDIR'], ['deputySingle', 'WAKIL_MUDIR'], ['teacher', 'TEACHER'], ['guardian', 'GUARDIAN'], ['student', 'STUDENT']]) {
  test('non-admin context and direct backend writes are denied: ' + role, async ({ page }) => {
    await login(page, name); const base = path(name, role);
    await page.goto(base + '/structure'); await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
    expect((await page.request.get(base + '/structure/data')).status()).toBe(403);
    await write(page, { entity: 'level', values: { name: 'Forbidden', code: 'DENIED', sort_order: 0, is_active: true } }, 403, base + '/structure/data');
    const denied = await rest(name, '/institution_levels', 'POST', { institution_id: f.institutions.A, name: 'Forbidden', code: 'DENIED' });
    expect(denied.status).toBe(403); expect(denied.body.code).toBe('42501');
    const types = await rest(name, '/program_types?select=id');
    for (const [table, body] of [
      ['programs', { institution_id: f.institutions.A, name: 'Forbidden', program_type_id: types.body[0].id }],
      ['groups', { institution_id: f.institutions.A, name: 'Forbidden', program_id: f.programs.a }],
      ['program_levels', { institution_id: f.institutions.A, program_id: randomUUID(), level_id: randomUUID() }],
    ] as const) expect((await rest(name, '/' + table, 'POST', body)).status).toBe(403);
  });
}

test('admin in a non-admin UI mode cannot mutate through that mode even with union DB permission', async ({ page }) => {
  await login(page); const url = path('structureAdmin', 'GUARDIAN') + '/structure/data';
  expect((await page.request.get(url)).status()).toBe(403);
  await write(page, { entity: 'level', values: { name: 'Denied mode', code: 'MODE', sort_order: 1, is_active: true } }, 403, url);
});
test('program duplicate names follow existing contract, never silently upsert', async ({ page }) => {
  await login(page); const p = await program(page);
  await write(page, { entity: 'program', values: { name: p.name, description: null, program_type_id: p.program_type_id } });
  expect((await read(page)).programs.filter(x => x.name === p.name)).toHaveLength(2);
});
test('level edit, sort order, inactive status, and duplicate code conflict', async ({ page }) => {
  await login(page); let l = await level(page);
  await write(page, levelEdit(l, { name: 'M13 Edited level', sort_order: 3 }));
  l = (await read(page)).levels.find(x => x.id === l.id)!; expect(l.sort_order).toBe(3); expect(l.name).toBe('M13 Edited level');
  await write(page, { entity: 'level', values: { name: 'Other level', code: l.code, sort_order: 4, is_active: true } }, 409);
  await write(page, levelEdit(l, { is_active: false }));
  expect((await read(page)).levels.find(x => x.id === l.id)?.is_active).toBe(false);
});
test('relation duplicate rejects; detach is non-destructive and can be reactivated', async ({ page }) => {
  await login(page); const p = await program(page), l = await level(page), r = await relation(page, p, l);
  await write(page, { entity: 'relation', values: { program_id: p.id, level_id: l.id } }, 409);
  await write(page, { entity: 'relation', id: r.id, values: { is_active: false }, expected: { is_active: true } });
  expect((await read(page)).relations.find(x => x.id === r.id)?.is_active).toBe(false);
  await write(page, { entity: 'relation', id: r.id, values: { is_active: true }, expected: { is_active: false } });
});
test('class create/edit/deactivate and relation deactivation retain its academic context', async ({ page }) => {
  await login(page); const p = await program(page), l = await level(page), r = await relation(page, p, l), name = 'M13 Class ' + id();
  await write(page, { entity: 'group', values: { name, program_id: p.id, program_level_id: r.id } });
  let g = (await read(page)).groups.find(x => x.name === name)!;
  await write(page, { entity: 'relation', id: r.id, values: { is_active: false }, expected: { is_active: true } });
  await write(page, groupEdit(g, { name: name + ' edited' }));
  g = (await read(page)).groups.find(x => x.id === g.id)!;
  await write(page, groupEdit(g, { is_active: false, status: 'INACTIVE' }));
  g = (await read(page)).groups.find(x => x.id === g.id)!;
  expect(g.is_active).toBe(false); expect(g.status).toBe('INACTIVE'); expect(g.program_level_id).toBe(r.id);
  const audit = await rest('structureAdmin', '/audit_logs?entity_id=eq.' + g.id + '&select=action,actor_profile_id,institution_id');
  expect(audit.body.filter((x: { action: string }) => x.action === 'UPDATE')).toHaveLength(2);
  expect(audit.body.every((x: { actor_profile_id: string; institution_id: string }) => x.actor_profile_id === f.accounts.structureAdmin.profileId && x.institution_id === f.institutions.A)).toBe(true);
});
test('legacy class has no guessed level; placement history prevents context changes', async ({ page }) => {
  await enter(page); await page.getByRole('button', { name: 'Kelas / Halaqah', exact: true }).click();
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Kelas a1', exact: true }) });
  await expect(row).toContainText('Tingkatan belum ditentukan');
  const data = await read(page), g = data.groups.find(g => g.name === 'Kelas a1')!, p = data.programs.find(p => p.id === g.program_id)!;
  const l = await level(page), r = await relation(page, p, l);
  await write(page, groupEdit(g, { program_level_id: r.id }), 400);
  expect((await read(page)).groups.find(x => x.id === g.id)?.program_level_id).toBeNull();
});
test('program/level/group ID tampering and tenant/program mismatch are denied by app and RLS', async ({ page }) => {
  await login(page); const pA = await program(page), pB = await program(page, f.institutions.B), lB = await level(page, f.institutions.B);
  await write(page, programEdit(pB, 'Forbidden'), 409);
  await write(page, levelEdit(lB, { name: 'Forbidden' }), 409);
  await write(page, { entity: 'relation', values: { program_id: pA.id, level_id: lB.id } }, 409);
  const lA = await level(page), r = await relation(page, pA, lA), pOther = await program(page);
  await write(page, { entity: 'group', values: { name: 'Wrong program', program_id: pOther.id, program_level_id: r.id } }, 400);
  await write(page, { entity: 'group', values: { name: 'Wrong tenant', program_id: pB.id, program_level_id: null } }, 409);
  const dataB = await read(page, f.institutions.B), gB = dataB.groups[0];
  await write(page, groupEdit(gB, { name: 'Forbidden' }), 409);
  for (const [table, recordId] of [['programs', pB.id], ['institution_levels', lB.id], ['groups', gB.id]]) {
    expect((await rest('adminA', '/' + table + '?id=eq.' + recordId, 'PATCH', { name: 'Forbidden' })).body).toEqual([]);
  }
  expect((await rest('adminA', '/program_levels', 'POST', { institution_id: f.institutions.A, program_id: pA.id, level_id: lB.id })).status).toBe(409);
  expect((await read(page, f.institutions.B)).programs.find(p => p.id === pB.id)?.name).toBe(pB.name);
});
test('two admins cannot silently overwrite a stale program or level snapshot', async ({ page, browser }) => {
  await login(page); const p = await program(page), l = await level(page);
  const second = await browser.newContext(), other = await second.newPage();
  try {
    await login(other, 'adminA');
    await write(other, programEdit(p, 'M13 Changed by another admin'), 200, path('adminA') + '/structure/data');
    await write(page, programEdit(p, 'Overwrite'), 409);
    await write(other, levelEdit(l, { sort_order: 19 }), 200, path('adminA') + '/structure/data');
    await write(page, levelEdit(l, { sort_order: 20 }), 409);
  } finally { await second.close(); }
  expect((await read(page)).levels.find(x => x.id === l.id)?.sort_order).toBe(19);
});
test('CSRF, forged ownership fields, missing session and invalid fields fail closed', async ({ page, request }) => {
  expect((await request.post(origin + endpoint(), { data: { entity: 'level' }, headers: { Origin: 'https://foreign.invalid' } })).status()).toBe(403);
  const anon = await request.get(origin + endpoint()); expect(anon.url()).toContain('/login');
  await login(page);
  expect((await page.request.post(endpoint(), { data: {}, headers: { Origin: 'https://foreign.invalid' } })).status()).toBe(403);
  expect((await page.request.post(endpoint(), { data: { entity: 'level', values: { name: 'Bad', code: 'BAD', sort_order: 0, is_active: true, institution_id: f.institutions.B } }, headers: { Origin: origin } })).status()).toBe(400);
});
test('institution and role switching discard old tenant forms, action state and data', async ({ page }) => {
  await enter(page); await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  const switcher = page.getByRole('dialog', { name: 'Ganti konteks', exact: true });
  await switcher.getByRole('radio', { name: /Lembaga Uji B/ }).check(); await switcher.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('structureAdmin', 'INSTITUTION_ADMIN', f.institutions.B) + '$'));
  await page.getByRole('navigation', { name: 'Navigasi desktop' }).getByRole('link', { name: 'Struktur lembaga' }).click();
  await expect(page.getByRole('heading', { name: 'Program a', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tambah program', exact: true }).click();
  await page.getByLabel('Nama program', { exact: true }).fill('Unsaved context data'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  await switcher.getByRole('radio', { name: /· Wali/ }).check(); await switcher.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('structureAdmin', 'GUARDIAN') + '$'));
  await expect(page.getByTestId('organization-manager')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Tambah program' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navigasi desktop' }).getByRole('link', { name: 'Struktur lembaga' })).toHaveCount(0);
});
test('revoked admin membership removes forms and rejects writes on revalidation', async ({ page, request }) => {
  await login(page, 'structureRevoked'); const base = path('structureRevoked'); await page.goto(base + '/structure');
  await expect(page.getByRole('button', { name: 'Tambah program', exact: true })).toBeVisible();
  const revoked = await request.post(process.env.NGT_WEB_STRUCTURE_REVOKE_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN } }); expect(revoked.status()).toBe(204);
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tambah program' })).toHaveCount(0);
  await write(page, { entity: 'level', values: { name: 'Forbidden', code: 'REVOKED', sort_order: 0, is_active: true } }, 403, base + '/structure/data');
});
test('loading, empty search, outage and retry do not retain a stale dataset', async ({ page }) => {
  await login(page); let release!: () => void, arrived!: () => void;
  const hold = new Promise<void>(r => { release = r; }), seen = new Promise<void>(r => { arrived = r; });
  await page.route('**/structure/data', async route => { arrived(); await hold; await route.continue(); });
  await page.goto(path() + '/structure'); await seen; await expect(page.getByText('Memuat struktur lembaga…')).toBeVisible(); release();
  await expect(page.getByRole('button', { name: 'Tambah program', exact: true })).toBeVisible(); await page.unroute('**/structure/data');
  await page.getByLabel('Cari program', { exact: true }).fill('no-such-program-' + id()); await expect(page.getByRole('heading', { name: 'Tidak ada hasil' })).toBeVisible();
  await page.route('**/structure/data', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"unavailable"}}' }));
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Struktur belum tersedia' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Daftar program' })).toHaveCount(0);
  await page.unroute('**/structure/data'); await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tambah program', exact: true })).toBeVisible();
});
test('responsive organization page and keyboard dialog keep focus and support reduced motion', async ({ page }) => {
  await enter(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.getByLabel('Cari program', { exact: true }).boundingBox())!.width).toBeGreaterThan(200);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Tingkatan', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Tambah tingkatan', exact: true }); await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Tutup', exact: true })).toBeFocused();
  for (let n = 0; n < 10; n++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.screenshot({ path: '../../reports/web-13.1-dialog-mobile.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: '../../reports/web-13.1-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: '../../reports/web-13.1-desktop.png', fullPage: true });
});
