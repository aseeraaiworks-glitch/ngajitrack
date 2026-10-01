import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const fixture = JSON.parse(process.env.NGT_WEB_CONTEXT_FIXTURE!) as { accounts: Record<string, { email: string; memberships: { id: string; institution_id: string; code: string }[] }> };
type Captured = { tags: { runtime: string; route: string }; exception: unknown; environment: string; release: string };
async function events(request: APIRequestContext): Promise<Captured[]> {
  const response = await request.get(process.env.NGT_WEB_MONITORING_EVENTS_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN! } });
  expect(response.status()).toBe(200); return response.json();
}
async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(fixture.accounts[name].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.NGT_WEB_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}
test('enabled SDK captures an unexpected browser exception with no free-text or user data', async ({ page, request }) => {
  await page.goto('/login'); const baseline = (await events(request)).length;
  await page.evaluate(() => { setTimeout(() => { throw new TypeError('sentry-private-sentinel email@example.invalid password body phone'); }, 0); });
  await expect.poll(async () => (await events(request)).length).toBeGreaterThan(baseline);
  const captured = (await events(request)).slice(baseline);
  expect(captured.some(event => event.tags.runtime === 'client')).toBe(true);
  expect(JSON.stringify(captured)).not.toContain('sentry-private-sentinel');
  expect(captured[0].environment).toBe('test'); expect(captured[0].release).toBe('ngajitrack-web@0.1.0');
});
test('unhandled asynchronous rejection is captured and redacted', async ({ page, request }) => {
  await page.goto('/login'); const baseline = (await events(request)).length;
  await page.evaluate(() => { void Promise.reject(new Error('sentry-private-sentinel refresh_token personal Qur’an notes')); });
  await expect.poll(async () => (await events(request)).length).toBeGreaterThan(baseline);
  expect(JSON.stringify((await events(request)).slice(baseline))).not.toContain('sentry-private-sentinel');
});
test('wrong login, no context and permission denial are not crashes', async ({ page, request }) => {
  const baseline = (await events(request)).length;
  await page.goto('/login'); await page.getByLabel('Email', { exact: true }).fill(fixture.accounts.super.email);
  await page.getByLabel('Kata sandi', { exact: true }).fill('intentionally-wrong-test-input');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.locator('#login-error')).toContainText('Email atau kata sandi tidak sesuai');
  await login(page, 'super'); await expect(page.getByRole('heading', { name: 'Belum ada konteks yang tersedia' })).toBeVisible();
  const other = fixture.accounts.outsider.memberships.find(m => m.code === 'MUDIR')!;
  await page.goto('/app/i/' + other.institution_id + '/as/' + other.id);
  await expect(page.getByRole('heading', { name: 'Konteks tidak tersedia', exact: true })).toBeVisible();
  await page.waitForTimeout(600);
  expect((await events(request)).length).toBe(baseline);
});
test('logout leaves no session/account/context material in a later exception', async ({ page, request }) => {
  await login(page, 'teacher'); await expect(page.getByRole('button', { name: 'Keluar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  const baseline = (await events(request)).length;
  await page.evaluate(() => { setTimeout(() => { throw new Error('sentry-private-sentinel access_token cookies name phone'); }, 0); });
  await expect.poll(async () => (await events(request)).length).toBeGreaterThan(baseline);
  const payload = JSON.stringify((await events(request)).slice(baseline));
  expect(payload).not.toContain(fixture.accounts.teacher.email); expect(payload).not.toContain(process.env.NGT_WEB_TEST_PASSWORD!);
  expect(payload).not.toContain('sentry-private-sentinel'); expect(payload).not.toContain('user'); expect(payload).not.toContain('cookies');
});
test('handled unexpected context service failure is reported without becoming a granted or empty context', async ({ page, request }) => {
  const baseline = (await events(request)).length;
  await login(page, 'loadError');
  await expect(page.getByRole('heading', { name: 'Konteks belum dapat dimuat', exact: true })).toBeVisible();
  await expect(page.getByTestId('shell-role')).toHaveCount(0);
  await expect.poll(async () => (await events(request)).slice(baseline).some(event => event.tags.runtime === 'server')).toBe(true);
  expect(JSON.stringify((await events(request)).slice(baseline))).not.toContain(fixture.accounts.loadError.email);
});
test('server runtime and boundary capture unexpected failure while safe retry still recovers', async ({ page, request }) => {
  const baseline = (await events(request)).length;
  await login(page, 'boundaryError');
  await expect(page.getByRole('heading', { name: 'Belum dapat memuat halaman', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
  await expect(page.getByText('synthetic private profile failure')).toHaveCount(0);
  await expect.poll(async () => (await events(request)).slice(baseline).some(event => event.tags.runtime === 'server')).toBe(true);
  await expect.poll(async () => (await events(request)).slice(baseline).some(event => event.tags.runtime === 'client')).toBe(true);
  const routeFailure = await page.request.get('/app/context-options');
  expect(routeFailure.status()).toBe(500);
  await expect.poll(async () => (await events(request)).slice(baseline).some(event => event.tags.runtime === 'server' && event.tags.route === '/app/context-options')).toBe(true);
  const payload = JSON.stringify((await events(request)).slice(baseline));
  expect(payload).not.toContain(fixture.accounts.boundaryError.email); expect(payload).not.toContain('synthetic private profile failure');
  const restored = await request.post(process.env.NGT_WEB_RESTORE_PROFILE_URL!, { headers: { Authorization: 'Bearer ' + process.env.NGT_WEB_LAB_CONTROL_TOKEN! } });
  expect(restored.status()).toBe(204); await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
  await expect(page.getByTestId('shell-role')).toContainText('Ustaz');
});
