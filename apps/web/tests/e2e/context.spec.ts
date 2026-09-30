import { test, expect, type Page } from '@playwright/test';
type Account = { email: string; id: string; profileId: string; memberships: { id: string; institution_id: string; code: string }[] };
const fixture = JSON.parse(process.env.NGT_WEB_CONTEXT_FIXTURE!) as { accounts: Record<string, Account>; institutions: { A: string; B: string } };
const password = process.env.NGT_WEB_TEST_PASSWORD!;
const account = (name: string) => fixture.accounts[name];
function member(name: string, role: string, institution = fixture.institutions.A) {
  return account(name).memberships.find(m => m.code === role && m.institution_id === institution)!;
}
const path = (name: string, role: string, institution = fixture.institutions.A) => '/app/i/' + institution + '/as/' + member(name, role, institution).id;
const storageKey = (name: string) => 'ngajitrack.context.v1:' + account(name).id;
async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account(name).email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}
async function store(page: Page, name: string, value: string) {
  await page.goto('/login');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey(name), value });
}
test('platform role and Auth metadata alone do not create an institution context', async ({ page }) => {
  await login(page, 'super');
  await expect(page.getByRole('heading', { name: 'Belum ada konteks yang tersedia' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
});
test('one institution and one role auto-selects its valid context', async ({ page }) => {
  await login(page, 'adminB');
  await expect(page).toHaveURL(new RegExp(path('adminB', 'INSTITUTION_ADMIN', fixture.institutions.B) + '$'));
  await expect(page.getByTestId('active-institution')).toHaveText('Lembaga Uji B');
});
test('multiple institutions require choosing a context', async ({ page }) => {
  await login(page, 'teacher');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.getByRole('radio', { name: /Lembaga Uji A/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Lembaga Uji B/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gunakan konteks' })).toBeDisabled();
});
test('same institution multi-role does not auto-select the most privileged role', async ({ page }) => {
  await login(page, 'adminA');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.locator('input:checked')).toHaveCount(0);
});
test('Mudir plus Wali has separate contexts and no previous-mode content after navigation', async ({ page }) => {
  await login(page, 'outsider');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByRole('radio', { name: /· Mudir/ }).check();
  await page.getByRole('button', { name: 'Gunakan konteks' }).click();
  await expect(page).toHaveURL(new RegExp(path('outsider', 'MUDIR') + '$'));
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan seluruh lembaga');
  await page.goto(path('outsider', 'GUARDIAN'));
  await expect(page.getByTestId('active-scope')).toHaveText('Sesuai hubungan dan penugasan Anda');
  await expect(page.getByText('Cakupan seluruh lembaga', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mudir', exact: true })).toHaveCount(0);
});
test('deputy one program scope is explicit', async ({ page }) => {
  await login(page, 'deputySingle');
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan program: Program a');
});
test('deputy multiple program scopes remains one membership context', async ({ page }) => {
  await login(page, 'deputyMultiple');
  await expect(page).toHaveURL(new RegExp(path('deputyMultiple', 'WAKIL_MUDIR') + '$'));
  await expect(page.getByTestId('active-scope')).toContainText('Program a');
  await expect(page.getByTestId('active-scope')).toContainText('Program aOther');
});
test('deputy institution-wide scope is explicit', async ({ page }) => {
  await login(page, 'institutionDeputy');
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan seluruh lembaga');
});
test('deputy plus Wali retains distinct query contexts', async ({ page }) => {
  await login(page, 'guardian');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.getByRole('radio')).toHaveCount(2);
  await page.getByRole('radio', { name: /Wakil Mudir/ }).check();
  await page.getByRole('button', { name: 'Gunakan konteks' }).click();
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan program: Program a');
});
for (const name of ['noScope', 'expired', 'revoked', 'inactiveProgram']) {
  test('invalid leadership scope is never offered: ' + name, async ({ page }) => {
    await login(page, name);
    await expect(page.getByRole('heading', { name: 'Belum ada konteks yang tersedia' })).toBeVisible();
    await page.goto(path(name, 'WAKIL_MUDIR'));
    await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
    await expect(page.getByTestId('active-scope')).toHaveCount(0);
  });
}
test('valid preference is revalidated and preselected, without auto-entering multi-role context', async ({ page }) => {
  await store(page, 'outsider', JSON.stringify({ institutionId: fixture.institutions.A, membershipId: member('outsider', 'GUARDIAN').id }));
  await login(page, 'outsider');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.locator('input:checked')).toHaveValue(fixture.institutions.A + ':' + member('outsider', 'GUARDIAN').id);
});
test('invalid preference is removed and user must explicitly choose even for a single context', async ({ page }) => {
  await store(page, 'adminB', JSON.stringify({ institutionId: fixture.institutions.A, membershipId: member('adminA', 'INSTITUTION_ADMIN').id }));
  await login(page, 'adminB');
  await expect(page).toHaveURL(/\/app\/select-context$/);
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey('adminB'))).toBeNull();
});
test('direct deep link validates membership ownership and persists only IDs', async ({ page }) => {
  await login(page, 'teacher');
  await expect(page).toHaveURL(/\/select-context$/);
  await page.goto(path('teacher', 'GUARDIAN', fixture.institutions.B));
  await expect(page.getByTestId('active-institution')).toHaveText('Lembaga Uji B');
  const stored = await page.evaluate(key => localStorage.getItem(key), storageKey('teacher'));
  expect(JSON.parse(stored!)).toEqual({ institutionId: fixture.institutions.B, membershipId: member('teacher', 'GUARDIAN', fixture.institutions.B).id });
});
test('cross-tenant and another users membership deep links are denied', async ({ page }) => {
  await login(page, 'teacher');
  await expect(page).toHaveURL(/\/select-context$/);
  for (const target of [path('adminA', 'INSTITUTION_ADMIN'), '/app/i/' + fixture.institutions.B + '/as/' + member('teacher', 'TEACHER').id, '/app/i/not-a-uuid/as/not-a-membership']) {
    await page.goto(target);
    await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
    await expect(page.getByTestId('active-institution')).toHaveCount(0);
  }
});
test('logout clears stored context, with no account data after back navigation', async ({ page }) => {
  await login(page, 'deputySingle');
  await expect(page.getByTestId('active-scope')).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey('deputySingle'))).toBeNull();
  await page.goBack();
  await expect(page.getByTestId('active-institution')).toHaveCount(0);
});
test('missing application profile is explicit and never provisioned by bootstrap', async ({ page }) => {
  await store(page, 'missingProfile', JSON.stringify({ institutionId: fixture.institutions.A, membershipId: member('adminA', 'INSTITUTION_ADMIN').id }));
  await login(page, 'missingProfile');
  await expect(page.getByRole('heading', { name: 'Akses profil belum tersedia' })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), storageKey('missingProfile'))).toBeNull();
});
test('context query failure is an error state, not empty or granted access', async ({ page }) => {
  await login(page, 'loadError');
  await expect(page.getByRole('heading', { name: 'Konteks belum dapat dimuat' })).toBeVisible();
  await expect(page.getByTestId('active-institution')).toHaveCount(0);
  await expect(page.getByText('synthetic context outage', { exact: false })).toHaveCount(0);
});
test('session invalidated while bootstrap runs returns to login without context data', async ({ page }) => {
  const bootstrapAttempt = page.waitForResponse(response => new URL(response.url()).pathname === '/app' && response.request().isNavigationRequest());
  await login(page, 'lostSession');
  await bootstrapAttempt;
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByTestId('active-institution')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
});
test('selection is usable at mobile width with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'outsider');
  await expect(page).toHaveURL(/\/select-context$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('radio', { name: /· Mudir/ }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Gunakan konteks' }).press('Enter');
  await expect(page.getByTestId('active-scope')).toHaveText('Cakupan seluruh lembaga');
  await page.screenshot({ path: '../../reports/web-context-mobile.png', fullPage: true });
});
