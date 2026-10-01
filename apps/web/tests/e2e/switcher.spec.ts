import { test, expect, type Page } from '@playwright/test';
type Account = { id: string; email: string; memberships: { id: string; institution_id: string; code: string }[] };
const fixture = JSON.parse(process.env.NGT_WEB_CONTEXT_FIXTURE!) as {
  accounts: Record<string, Account>; institutions: { A: string; B: string }; programs: { a: string; other: string };
};
const optionsRoute = '**/app/context-options';
const preference = (name: string) => 'ngajitrack.context.v1:' + fixture.accounts[name].id;
function path(name: string, role: string, institution = fixture.institutions.A) {
  const member = fixture.accounts[name].memberships.find(m => m.code === role && m.institution_id === institution)!;
  return '/app/i/' + institution + '/as/' + member.id;
}
async function enter(page: Page, name: string, role: string, institution = fixture.institutions.A) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(fixture.accounts[name].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.NGT_WEB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$)/);
  // Wait for bootstrap navigation, then explicitly enter the desired valid context.
  await expect(page.getByRole('button', { name: 'Ganti konteks', exact: true }).or(page.getByRole('heading', { name: 'Pilih konteks Anda' }))).toBeVisible();
  await page.goto(path(name, role, institution));
  await expect(page.getByTestId('active-scope')).toBeVisible();
}
async function open(page: Page) {
  await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ganti konteks' });
  await expect(dialog.getByRole('button', { name: 'Pindah konteks' })).toBeVisible();
  return dialog;
}
async function switchRole(page: Page, label: RegExp) {
  const dialog = await open(page);
  await dialog.getByRole('radio', { name: label }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('active-scope')).toBeVisible();
}
test('Mudir to Wali and back uses switcher, clears old presentation and reloads without login', async ({ page }) => {
  await enter(page, 'outsider', 'MUDIR');
  await switchRole(page, /· Wali/);
  await expect(page).toHaveURL(new RegExp(path('outsider', 'GUARDIAN') + '$'));
  await expect(page.getByRole('heading', { name: 'Wali', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mudir', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('active-scope')).toHaveText('Sesuai hubungan dan penugasan Anda');
  await switchRole(page, /· Mudir/);
  await expect(page).toHaveURL(new RegExp(path('outsider', 'MUDIR') + '$'));
  await expect(page.getByRole('heading', { name: 'Wali', exact: true })).toHaveCount(0);
});
test('Admin plus teacher can switch roles within the same institution', async ({ page }) => {
  await enter(page, 'adminA', 'INSTITUTION_ADMIN');
  await switchRole(page, /· Ustaz/);
  await expect(page).toHaveURL(new RegExp(path('adminA', 'TEACHER') + '$'));
  await switchRole(page, /· Admin Lembaga/);
  await expect(page).toHaveURL(new RegExp(path('adminA', 'INSTITUTION_ADMIN') + '$'));
});
test('institution switch replaces tenant presentation and intent', async ({ page }) => {
  await enter(page, 'teacher', 'TEACHER');
  await switchRole(page, /Lembaga Uji B · Wali/);
  await expect(page.getByTestId('active-institution')).toHaveText('Lembaga Uji B');
  await expect(page.getByRole('heading', { name: 'Ustaz', exact: true })).toHaveCount(0);
  await switchRole(page, /Lembaga Uji A · Ustaz/);
  await expect(page.getByTestId('active-institution')).toHaveText('Lembaga Uji A');
});
test('single program scope can select its explicit focus and persists after reload', async ({ page }) => {
  await enter(page, 'deputySingle', 'WAKIL_MUDIR');
  const dialog = await open(page);
  await expect(dialog.getByLabel('Cakupan program', { exact: true }).locator('option')).toHaveCount(2);
  await dialog.getByLabel('Cakupan program', { exact: true }).selectOption(fixture.programs.a);
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp('\\?program=' + fixture.programs.a + '$'));
  await page.reload();
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan program: Program a');
});
test('multiple program scopes switch A to B and back to all assigned without broadening', async ({ page }) => {
  await enter(page, 'deputyMultiple', 'WAKIL_MUDIR');
  for (const [id, label] of [[fixture.programs.a, 'Cakupan program: Program a'], [fixture.programs.other, 'Cakupan program: Program aOther'], ['', 'Cakupan program: Program a, Program aOther']]) {
    const dialog = await open(page);
    await dialog.getByLabel('Cakupan program', { exact: true }).selectOption(id);
    await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('active-scope')).toHaveText(label);
    expect(new URL(page.url()).searchParams.get('program')).toBe(id || null);
  }
});
test('institution scope does not fabricate a program selector', async ({ page }) => {
  await enter(page, 'institutionDeputy', 'WAKIL_MUDIR');
  const dialog = await open(page);
  await expect(dialog.getByLabel('Cakupan program', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('radio')).toHaveCount(1);
});
test('scope revoked while menu is open fails fresh selection, clears stale mode and rejects deep link', async ({ page, request }) => {
  await enter(page, 'switchRevoked', 'WAKIL_MUDIR');
  const dialog = await open(page);
  const response = await request.post(process.env.NGT_WEB_LAB_CONTROL_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN! } });
  expect(response.status()).toBe(204);
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Pilihan tidak lagi tersedia. Pilih konteks lain.');
  await expect(dialog.getByRole('radio', { name: /Wakil Mudir/ })).toHaveCount(0);
  await expect(page.getByTestId('active-scope')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), preference('switchRevoked'))).toBeNull();
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('switchRevoked', 'GUARDIAN') + '$'));
  await page.goto(path('switchRevoked', 'WAKIL_MUDIR'));
  await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
});
test('invalid stored program focus is removed and requires explicit selection', async ({ page }) => {
  await enter(page, 'deputySingle', 'WAKIL_MUDIR');
  await page.evaluate(({ key, programId }) => { const value = JSON.parse(localStorage.getItem(key)!); localStorage.setItem(key, JSON.stringify({ ...value, programId })); },
    { key: preference('deputySingle'), programId: fixture.programs.other });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/select-context$/);
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), preference('deputySingle'))).toBeNull();
});
test('foreign program, duplicate parameter and cross-tenant/member manipulation fail closed', async ({ page }) => {
  await enter(page, 'deputySingle', 'WAKIL_MUDIR');
  for (const target of [path('deputySingle', 'WAKIL_MUDIR') + '?program=' + fixture.programs.other,
    path('deputySingle', 'WAKIL_MUDIR') + '?program=' + fixture.programs.a + '&program=' + fixture.programs.other,
    path('adminB', 'INSTITUTION_ADMIN', fixture.institutions.B), path('outsider', 'MUDIR')]) {
    await page.goto(target);
    await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
    await expect(page.getByTestId('active-scope')).toHaveCount(0);
  }
});
test('cancelled slow options cannot overwrite a newly opened menu', async ({ page }) => {
  await enter(page, 'outsider', 'MUDIR');
  let release!: () => void, seen!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { seen = resolve; });
  let first = true;
  await page.route(optionsRoute, async route => {
    if (!first) return route.continue();
    first = false;
    const response = await route.fetch(); seen(); await hold;
    await route.fulfill({ response, json: { userId: fixture.accounts.outsider.id, contexts: [] } }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  await arrived; await page.keyboard.press('Escape');
  const dialog = await open(page);
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  release();
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('outsider', 'GUARDIAN') + '$'));
});
test('old presentation is absent during delayed switch; cancelled late validation cannot navigate', async ({ page }) => {
  await enter(page, 'outsider', 'MUDIR');
  const dialog = await open(page);
  let release!: () => void, seen!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { seen = resolve; });
  await page.route(optionsRoute, async route => {
    const response = await route.fetch(); seen(); await hold;
    await route.fulfill({ response }).catch(() => {});
  });
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await arrived;
  await expect(page.getByTestId('active-scope')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mudir', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape'); release();
  await expect(page.getByRole('heading', { name: 'Konteks perlu diperiksa kembali', exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(path('outsider', 'MUDIR') + '$'));
  await page.unroute(optionsRoute);
  await switchRole(page, /· Wali/);
  await expect(page).toHaveURL(new RegExp(path('outsider', 'GUARDIAN') + '$'));
});
test('two tabs retain independent URL contexts; logout still clears both and preference', async ({ page, context }) => {
  await enter(page, 'outsider', 'MUDIR');
  const other = await context.newPage();
  await other.goto(path('outsider', 'MUDIR'));
  await expect(other.getByTestId('active-scope')).toBeVisible();
  await switchRole(page, /· Wali/);
  await expect(other).toHaveURL(new RegExp(path('outsider', 'MUDIR') + '$'));
  await expect(other.getByTestId('active-scope')).toHaveText('Cakupan seluruh lembaga');
  await other.reload();
  await expect(other.getByTestId('active-scope')).toHaveText('Cakupan seluruh lembaga');
  await expect(page.getByTestId('active-scope')).toHaveText('Sesuai hubungan dan penugasan Anda');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/); await expect(other).toHaveURL(/\/login$/);
  for (const tab of [page, other]) {
    await expect(tab.getByTestId('active-scope')).toHaveCount(0);
    expect(await tab.evaluate(key => localStorage.getItem(key), preference('outsider'))).toBeNull();
  }
});
test('keyboard dialog traps focus, Escape restores trigger, and mobile reduced-motion remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page, 'outsider', 'MUDIR');
  const trigger = page.getByRole('button', { name: 'Ganti konteks', exact: true });
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Ganti konteks' });
  await expect(dialog.getByRole('button', { name: 'Tutup', exact: true })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Pindah konteks' })).toBeVisible();
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../reports/web-switcher-mobile.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await dialog.getByRole('radio', { name: /· Wali/ }).focus(); await page.keyboard.press('Space');
  await dialog.getByRole('button', { name: 'Pindah konteks' }).press('Enter');
  await expect(page).toHaveURL(new RegExp(path('outsider', 'GUARDIAN') + '$'));
});
test('validation outage clears old mode and supports retry without leaking errors', async ({ page }) => {
  await enter(page, 'outsider', 'MUDIR');
  const dialog = await open(page);
  await page.route(optionsRoute, route => route.fulfill({ status: 503, body: 'synthetic private error' }));
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Konteks belum dapat diperiksa');
  await expect(page.getByTestId('active-scope')).toHaveCount(0);
  await expect(page.getByText('synthetic private error')).toHaveCount(0);
  await page.unroute(optionsRoute);
  await dialog.getByRole('button', { name: 'Coba lagi' }).click();
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('outsider', 'GUARDIAN') + '$'));
});
test('options endpoint is authenticated, private/no-store, and not an authorization mutation', async ({ page, request }) => {
  const anonymous = await request.get('/app/context-options', { maxRedirects: 0 });
  expect([303,307]).toContain(anonymous.status());
  await enter(page, 'outsider', 'MUDIR');
  const response = await page.request.get('/app/context-options');
  expect(response.ok()).toBe(true); expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.json();
  expect(body.userId).toBe(fixture.accounts.outsider.id);
  expect(body.contexts.map((c: { roleCode: string }) => c.roleCode).sort()).toEqual(['GUARDIAN','MUDIR']);
  expect((await page.request.post('/app/context-options')).status()).toBe(405);
});
