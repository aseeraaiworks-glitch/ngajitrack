import { test, expect, type Page } from '@playwright/test';
type Account = { id: string; email: string; memberships: { id: string; institution_id: string; code: string }[] };
const fixture = JSON.parse(process.env.NGT_WEB_CONTEXT_FIXTURE!) as { accounts: Record<string, Account>; institutions: { A: string; B: string }; programs: { a: string; other: string } };
function path(name: string, role: string, institution = fixture.institutions.A) {
  return '/app/i/' + institution + '/as/' + fixture.accounts[name].memberships.find(m => m.code === role && m.institution_id === institution)!.id;
}
async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(fixture.accounts[name].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.NGT_WEB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}
async function enter(page: Page, name = 'outsider', role = 'MUDIR') {
  await login(page, name);
  await expect(page.getByRole('button', { name: 'Ganti konteks', exact: true }).or(page.getByRole('heading', { name: 'Pilih konteks Anda' }))).toBeVisible();
  await page.goto(path(name, role));
  await expect(page.getByTestId('shell-role')).toBeVisible();
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigasi desktop' });
test('desktop shell, bounded content and collapsible navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await enter(page);
  await expect(nav(page)).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('shell-institution')).toHaveText('Lembaga Uji A');
  await expect(page.getByTestId('shell-role')).toHaveText('Mudir');
  const width = (await page.getByRole('complementary', { name: 'Panel navigasi' }).boundingBox())!.width;
  await page.getByRole('button', { name: 'Ciutkan navigasi' }).click();
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-collapsed', 'true');
  await expect.poll(async () => (await page.getByRole('complementary', { name: 'Panel navigasi' }).boundingBox())!.width).toBeLessThan(width);
  await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toBeVisible();
  await page.getByRole('button', { name: 'Perluas navigasi' }).click();
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-collapsed', 'false');
  expect(await page.locator('main').evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(1152);
  await page.screenshot({ path: '../../reports/web-shell-desktop.png', fullPage: true });
});
test('mobile drawer has keyboard focus trap, Escape return and usable context controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await enter(page);
  await expect(nav(page)).not.toBeVisible();
  const trigger = page.getByRole('button', { name: 'Buka navigasi' });
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Navigasi', exact: true });
  await expect(dialog.getByRole('button', { name: 'Tutup', exact: true })).toBeFocused();
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Shift+Tab'); expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: '../../reports/web-shell-drawer.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: 'Ganti konteks', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keluar', exact: true })).toBeVisible();
  const bounds = await trigger.boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  for (const width of [320,390,768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../../reports/web-shell-mobile.png', fullPage: true });
});
test('tablet drawer closes on desktop resize and does not leave content inert', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 }); await enter(page);
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigasi', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('dialog', { name: 'Navigasi', exact: true })).not.toBeVisible();
  await expect(nav(page)).toBeVisible();
  await nav(page).getByRole('link', { name: 'Pilihan konteks' }).click();
  await expect(page).toHaveURL(/\/select-context$/);
});
for (const [account, role, label] of [
  ['adminA','INSTITUTION_ADMIN','Ruang administrasi'], ['outsider','MUDIR','Ruang kepemimpinan'],
  ['deputyMultiple','WAKIL_MUDIR','Ruang kepemimpinan'], ['outsider','GUARDIAN','Ruang wali'],
  ['teacher','TEACHER','Ruang pengajaran'], ['student','STUDENT','Ruang santri'],
]) {
  test('navigation presents only selected role: ' + role, async ({ page }) => {
    await enter(page, account, role);
    await expect(nav(page).getByRole('link')).toHaveCount(role === 'INSTITUTION_ADMIN' ? 3 : 2);
    await expect(nav(page).getByRole('link', { name: label, exact: true })).toHaveAttribute('href', path(account, role));
    await expect(nav(page).getByText(/Analytics|Laporan|Dashboard|Segera hadir/)).toHaveCount(0);
    if (role === 'GUARDIAN') await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toHaveCount(0);
    if (role === 'WAKIL_MUDIR') {
      await page.goto(path(account, role) + '?program=' + fixture.programs.other);
      await expect(nav(page).getByRole('link', { name: label })).toHaveAttribute('href', path(account, role) + '?program=' + fixture.programs.other);
      await expect(page.getByTestId('active-scope')).toHaveText('Cakupan program: Program aOther');
    }
  });
}
test('shell drops institution, role and navigation while switch is pending, then loads only new mode', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ganti konteks' });
  await dialog.getByRole('radio', { name: /· Wali/ }).check();
  let release!: () => void, seen!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const arrived = new Promise<void>(resolve => { seen = resolve; });
  await page.route('**/app/context-options', async route => { const response = await route.fetch(); seen(); await hold; await route.fulfill({ response }); });
  await dialog.getByRole('button', { name: 'Pindah konteks' }).click(); await arrived;
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
  await expect(page.getByTestId('shell-institution')).toHaveCount(0);
  await expect(page.getByTestId('active-scope')).toHaveCount(0);
  await expect(page.locator('main [aria-busy="true"]')).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toHaveCount(0);
  release();
  await expect(page).toHaveURL(new RegExp(path('outsider','GUARDIAN') + '$'));
  await expect(page.getByTestId('shell-role')).toHaveText('Wali');
  await expect(nav(page).getByRole('link', { name: 'Ruang wali' })).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toHaveCount(0);
});
test('real scope revocation removes shell leadership labels/links and preserves valid Wali', async ({ page, request }) => {
  await enter(page, 'shellRevoked','WAKIL_MUDIR');
  const response = await request.post(process.env.NGT_WEB_SHELL_CONTROL_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN! } });
  expect(response.status()).toBe(204);
  await page.getByRole('button', { name: 'Ganti konteks', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ganti konteks' });
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
  await expect(nav(page).getByRole('link', { name: 'Ruang kepemimpinan' })).toHaveCount(0);
  await dialog.getByRole('radio', { name: /· Wali/ }).check(); await dialog.getByRole('button', { name: 'Pindah konteks' }).click();
  await expect(page.getByTestId('shell-role')).toHaveText('Wali');
  await page.goto(path('shellRevoked','WAKIL_MUDIR'));
  await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
});
test('cross-tenant deep link renders denial without foreign shell identity or navigation', async ({ page }) => {
  await enter(page, 'teacher','TEACHER');
  await page.goto(path('adminB','INSTITUTION_ADMIN',fixture.institutions.B));
  await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
  await expect(page.getByTestId('shell-institution')).toHaveCount(0);
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
  await expect(nav(page).getByRole('link')).toHaveCount(1);
});
test('online/offline indicator makes no sync claim and reconnect toast can be dismissed', async ({ page, context }) => {
  await enter(page);
  await expect(page.getByTestId('online-status')).toHaveText('Online');
  await context.setOffline(true);
  await expect(page.getByTestId('online-status')).toHaveText('Offline');
  await expect(page.getByTestId('offline-warning')).toContainText('Koneksi terputus. Sinkronisasi offline belum tersedia.');
  await context.setOffline(false);
  await expect(page.getByTestId('offline-warning')).toHaveCount(0);
  await expect(page.getByTestId('online-status')).toHaveText('Online');
  const notices = page.getByRole('complementary', { name: 'Notifikasi' });
  await expect(notices.getByRole('status')).toHaveText(/Terhubung kembali. Muat ulang halaman/);
  await notices.getByRole('button', { name: 'Tutup notifikasi' }).click();
  await expect(notices.getByRole('status')).toHaveCount(0);
});
test('reduced motion disables shell/content/drawer transitions and tokens can be overridden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await enter(page);
  expect(await page.getByTestId('app-shell').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  expect(await page.getByTestId('context-content').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Navigasi', exact: true });
  expect(await dialog.evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  const before = await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor);
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  expect(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(before);
  await expect(page.getByTestId('shell-role')).toHaveText('Mudir');
});
test('profile dialog keyboard handling and logout remove the whole authenticated shell', async ({ page }) => {
  await enter(page);
  const trigger = page.getByRole('button', { name: 'Buka profil akun' });
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Profil akun' });
  await expect(dialog).toBeVisible(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  await page.goBack(); await expect(page.getByTestId('shell-role')).toHaveCount(0);
});
test('invalid session on reload never keeps prior shell/navigation', async ({ page, context }) => {
  await enter(page); await context.clearCookies(); await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
});
test('no context keeps account tools but does not invent role navigation', async ({ page }) => {
  await login(page, 'super');
  await expect(page.getByRole('heading', { name: 'Belum ada konteks yang tersedia' })).toBeVisible();
  await expect(nav(page).getByRole('link')).toHaveCount(1);
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keluar', exact: true })).toBeVisible();
});
test('server error boundary is generic and retry recovers without stale authenticated shell', async ({ page, request }) => {
  await login(page, 'boundaryError');
  await expect(page.getByRole('heading', { name: 'Belum dapat memuat halaman', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('synthetic private profile failure')).toHaveCount(0);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  const restored = await request.post(process.env.NGT_WEB_RESTORE_PROFILE_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN! } });
  expect(restored.status()).toBe(204);
  await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByTestId('shell-role')).toContainText('Ustaz');
});
