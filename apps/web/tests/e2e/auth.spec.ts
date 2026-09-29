import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const accounts: { email: string; id: string }[] = JSON.parse(process.env.NGT_WEB_TEST_ACCOUNTS ?? '[]');
const password = process.env.NGT_WEB_TEST_PASSWORD ?? '';
const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const origin = process.env.NGT_WEB_TEST_URL!;

async function login(page: Page, account = 0, path = '/login') {
  await page.goto(path);
  await page.getByLabel('Email', { exact: true }).fill(accounts[account].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(origin + '/app');
}
async function sessionCookies(context: BrowserContext) {
  return (await context.cookies()).filter(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a, b) => a.name.localeCompare(b.name));
}
async function session(context: BrowserContext) {
  const raw = (await sessionCookies(context)).map(cookie => cookie.value).join('');
  return JSON.parse(Buffer.from(raw.replace(/^base64-/, ''), 'base64url').toString());
}
async function setSession(context: BrowserContext, value: object) {
  const encoded = 'base64-' + Buffer.from(JSON.stringify(value)).toString('base64url');
  const name = 'sb-' + new URL(api).hostname.split('.')[0] + '-auth-token';
  await context.clearCookies();
  const chunks = encoded.match(/.{1,3000}/g)!;
  await context.addCookies(chunks.map((value, i) => ({ name: chunks.length === 1 ? name : `${name}.${i}`, value, url: origin, sameSite: 'Lax' as const })));
}

test('protected route redirects without a session and discloses no profile', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByTestId('profile-name')).toHaveCount(0);
});
test('wrong password shows a generic error without leaving login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill('deliberately-incorrect-test-input');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.locator('#login-error')).toHaveText('Email atau kata sandi tidak sesuai.');
  await expect(page).toHaveURL(origin + '/login');
});
test('correct login loads only own profile and survives reload', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('profile-name')).toHaveText('Akun Uji Satu');
  const response = await page.reload();
  await expect(page.getByTestId('profile-name')).toHaveText('Akun Uji Satu');
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.getByText('Akun Uji Dua', { exact: true })).toHaveCount(0);
});
test('logout removes auth cookies and previous account state, including back navigation', async ({ page, context }) => {
  await login(page);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
  expect(await sessionCookies(context)).toHaveLength(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ngajitrack') || key.startsWith('sb-')))).toHaveLength(0);
  await page.goBack();
  await expect(page.getByTestId('profile-name')).toHaveCount(0);
  await login(page, 1);
  await expect(page.getByTestId('profile-name')).toHaveText('Akun Uji Dua');
  await expect(page.getByText('Akun Uji Satu', { exact: true })).toHaveCount(0);
});
test('logout propagates to another open tab', async ({ page, context }) => {
  await login(page);
  const second = await context.newPage(); await second.goto('/app');
  await expect(second.getByTestId('profile-name')).toHaveText('Akun Uji Satu');
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(second).toHaveURL(origin + '/login');
  await expect(second.getByTestId('profile-name')).toHaveCount(0);
});
test('expired signed access token refreshes through SSR and retains the account', async ({ context, page, request }) => {
  const expired = JSON.parse(process.env.NGT_WEB_TEST_EXPIRED_SESSION!);
  await setSession(context, expired);
  await page.goto('/app');
  await expect(page.getByTestId('profile-name')).toHaveText('Akun Uji Satu');
  const renewed = await session(context);
  expect(renewed.access_token === expired.access_token).toBe(false);
  const response = await request.get(api + '/auth/v1/user', { headers: { apikey: key, Authorization: `Bearer ${renewed.access_token}` } });
  expect(response.ok()).toBe(true);
});
test('expired session without a valid refresh token is denied', async ({ context, page }) => {
  const expired = JSON.parse(process.env.NGT_WEB_TEST_EXPIRED_SESSION!);
  await setSession(context, { ...expired, refresh_token: 'invalid-refresh-fixture' });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('profile-name')).toHaveCount(0);
});
test('invalid session cannot authenticate a forged cookie profile', async ({ context, page }) => {
  const expired = JSON.parse(process.env.NGT_WEB_TEST_EXPIRED_SESSION!);
  await setSession(context, { ...expired, access_token: 'not-a-valid-jwt', refresh_token: 'invalid-refresh-fixture', expires_at: Math.floor(Date.now() / 1000) + 3600 });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('profile-name')).toHaveCount(0);
});
test('inactive profile has an access state without a redirect loop and can log out', async ({ page }) => {
  await login(page, 2);
  await expect(page.getByRole('heading', { name: 'Akses profil belum tersedia' })).toBeVisible();
  await expect(page.getByTestId('profile-name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(origin + '/login');
});
for (const destination of ['https://example.invalid', '//example.invalid', '/\\example.invalid', '%2f%2fexample.invalid']) {
  test(`redirect input stays internal: ${destination}`, async ({ page }) => {
    await login(page, 0, '/login?next=' + encodeURIComponent(destination));
    await expect(page).toHaveURL(origin + '/app');
  });
}
test('RLS rejects another profile even if the client changes its identity filter', async ({ page, context, request }) => {
  await login(page);
  const current = await session(context);
  const result = await request.get(api + '/rest/v1/profiles?select=full_name&auth_user_id=eq.' + accounts[1].id, { headers: { apikey: key, Authorization: `Bearer ${current.access_token}` } });
  expect(result.ok()).toBe(true);
  expect(await result.json()).toEqual([]);
});
test('login network error can be retried without showing raw errors', async ({ page }) => {
  await page.goto('/login');
  await page.route('**/auth/v1/token**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"private upstream detail"}' }));
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.locator('#login-error')).toContainText('Layanan masuk belum dapat dihubungi');
  await expect(page.getByText('private upstream detail', { exact: false })).toHaveCount(0);
});
test('mobile layout, reduced motion, keyboard login and offline indicator', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('section').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.screenshot({ path: '../../reports/web-login-mobile.png' });
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('Anda sedang offline');
  await context.setOffline(false);
  await page.getByLabel('Email', { exact: true }).fill(accounts[0].email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByLabel('Kata sandi', { exact: true }).press('Enter');
  await expect(page.getByTestId('profile-name')).toHaveText('Akun Uji Satu');
  await page.screenshot({ path: '../../reports/web-account-mobile.png' });
});
