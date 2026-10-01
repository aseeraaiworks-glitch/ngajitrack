// Real Auth/PostgREST + Next production build, entirely against a disposable lab.
// Runtime credentials are inherited in memory; never write storageState or traces.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { schedulerLab } from './scheduler-lab.mjs';
import { authApiLab } from './auth-api-lab.mjs';
import { webContextFixture } from '../tests/web-context-fixture.mjs';
import assert from 'node:assert/strict';

const web = new URL('../apps/web/', import.meta.url);
const require = createRequire(new URL('package.json', web));
const next = require.resolve('next/dist/bin/next');
const playwright = require.resolve('@playwright/test/cli');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
function child(file, args, env, background = false) {
  const processChild = spawn(process.execPath, [file, ...args], { cwd: fileURLToPath(web), env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
  if (background) return processChild;
  return new Promise((resolve, reject) => { processChild.on('error', reject); processChild.on('exit', code => code === 0 ? resolve() : reject(Error(`Web command failed (exit ${code})`))); });
}
let lab, api, gateway, app, contextFixture;
const requests = [];
let invalidateDuringBootstrap = false;
let failProfileLookup = true;
const controlToken = randomBytes(32).toString('hex');
try {
  lab = await schedulerLab({ through: '20260926001100' });
  api = await authApiLab(lab);
  gateway = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const route = req.url ?? '/';
    if (route === '/__lab/restore-profile-lookup') {
      if (req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + controlToken) { res.writeHead(403); res.end(); return; }
      failProfileLookup = false; res.writeHead(204); res.end(); return;
    }
    // Narrow fixture control in the disposable loopback gateway, never in Next.
    if (route === '/__lab/revoke-switch-scope' || route === '/__lab/revoke-shell-scope') {
      if (req.method !== 'POST' || req.headers.authorization !== 'Bearer ' + controlToken) { res.writeHead(403); res.end(); return; }
      try {
        await (route === '/__lab/revoke-shell-scope' ? contextFixture.revokeShellScope() : contextFixture.revokeLiveScope());
        res.writeHead(204); res.end();
      }
      catch { res.writeHead(500); res.end(); }
      return;
    }
    const upstream = route.startsWith('/auth/v1/') ? api.auth + route.slice(8) : route.startsWith('/rest/v1/') ? api.rest + route.slice(8) : null;
    if (!upstream) { res.writeHead(404); res.end(); return; }
    let userId;
    try { userId = JSON.parse(Buffer.from(String(req.headers.authorization).split('.')[1], 'base64url').toString()).sub; } catch { /* Anonymous request. */ }
    if (route.startsWith('/rest/v1/')) requests.push({ userId, route });
    if (contextFixture && userId === contextFixture.accounts.boundaryError.id && route.startsWith('/rest/v1/profiles?') && failProfileLookup) {
      res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"message":"synthetic private profile failure"}'); return;
    }
    // Deterministic fault injection only in the lab gateway; never in app routes.
    if (contextFixture && route === '/rest/v1/rpc/my_institutions') {
      if (userId === contextFixture.accounts.loadError.id) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"message":"synthetic context outage"}'); return; }
      if (userId === contextFixture.accounts.lostSession.id) invalidateDuringBootstrap = true;
    }
    if (contextFixture && invalidateDuringBootstrap && userId === contextFixture.accounts.lostSession.id && route === '/auth/v1/user') {
      res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"msg":"synthetic session expired"}'); return;
    }
    try {
      const body = []; for await (const chunk of req) body.push(chunk);
      const headers = new Headers();
      for (const name of ['authorization', 'content-type', 'apikey', 'x-client-info', 'x-supabase-api-version', 'prefer', 'accept']) if (req.headers[name]) headers.set(name, String(req.headers[name]));
      const response = await fetch(upstream, { method: req.method, headers, body: body.length ? Buffer.concat(body) : undefined });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') ?? 'application/json' });
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(502); res.end('{"message":"Isolated API unavailable"}'); }
  });
  const apiPort = await listen(gateway);
  const portProbe = createServer(); const port = await listen(portProbe); await new Promise(resolve => portProbe.close(resolve));
  const password = randomBytes(24).toString('base64url');
  const accounts = [];
  for (let i = 0; i < 3; i++) {
    const email = `web-${i}-${randomBytes(5).toString('hex')}@example.invalid`;
    const result = await fetch(api.auth + '/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, data: { full_name: ['Akun Uji Satu', 'Akun Uji Dua', 'Akun Nonaktif'][i] } }) });
    if (!result.ok) throw Error('Isolated account creation failed');
    const session = await result.json();
    accounts.push({ email, id: session.user.id });
  }
  await lab.query('update public.profiles set is_active=false where auth_user_id=$1', [accounts[2].id]);
  contextFixture = await webContextFixture(lab, api, password);
  const expiredResponse = await fetch(api.auth + '/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: accounts[0].email, password }) });
  const expiredSession = await expiredResponse.json();
  expiredSession.access_token = api.expiredAccessToken(expiredSession.access_token);
  expiredSession.expires_at = Math.floor(Date.now() / 1000) - 120;
  const rejected = await fetch(api.auth + '/user', { headers: { Authorization: `Bearer ${expiredSession.access_token}` } });
  if (rejected.ok) throw Error('Expired fixture token unexpectedly accepted');
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + randomBytes(24).toString('hex'),
    NEXT_TELEMETRY_DISABLED: '1',
    NGT_WEB_TEST_URL: `http://127.0.0.1:${port}`,
    NGT_WEB_TEST_ACCOUNTS: JSON.stringify(accounts),
    NGT_WEB_TEST_PASSWORD: password,
    NGT_WEB_TEST_EXPIRED_SESSION: JSON.stringify(expiredSession),
    NGT_WEB_CONTEXT_FIXTURE: JSON.stringify(contextFixture),
    NGT_WEB_LAB_CONTROL_URL: `http://127.0.0.1:${apiPort}/__lab/revoke-switch-scope`,
    NGT_WEB_SHELL_CONTROL_URL: `http://127.0.0.1:${apiPort}/__lab/revoke-shell-scope`,
    NGT_WEB_RESTORE_PROFILE_URL: `http://127.0.0.1:${apiPort}/__lab/restore-profile-lookup`,
    NGT_WEB_LAB_CONTROL_TOKEN: controlToken,
  };
  await child(next, ['build'], env);
  app = child(next, ['start', '--hostname', '127.0.0.1', '--port', String(port)], env, true);
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(env.NGT_WEB_TEST_URL + '/login')).ok) { ready = true; break; } } catch {} await setTimeout(500); }
  if (!ready) throw Error('Production web server did not start');
  await child(playwright, ['test', ...process.argv.slice(2)], env);
  const own = new Map(Object.values(contextFixture.accounts).map(a => [a.id, a.profileId]));
  for (const { userId, route } of requests) {
    const query = new URL(route, 'http://localhost');
    if (query.pathname === '/rest/v1/profiles' && own.has(userId)) {
      assert.equal(query.searchParams.get('auth_user_id'), 'eq.' + userId);
      assert.equal(query.searchParams.get('select'), 'id,full_name,preferred_name');
    }
    if (query.pathname === '/rest/v1/institution_members') {
      assert.equal(query.searchParams.get('profile_id'), 'eq.' + own.get(userId), 'Membership query must select the caller only');
      assert.ok(query.searchParams.get('institution_id')?.startsWith('in.('));
    }
    if (query.pathname === '/rest/v1/programs') {
      assert.ok(query.searchParams.get('id')?.startsWith('in.('), 'Program metadata must use explicit scope IDs');
      assert.equal(query.searchParams.get('is_active'), 'eq.true');
    }
    assert.ok(!['/rest/v1/institutions','/rest/v1/student_profiles','/rest/v1/guardian_students','/rest/v1/teacher_assignments','/rest/v1/rpc/monitor_students'].includes(query.pathname), 'Bootstrap must not fetch union business data');
  }
  assert.equal((await lab.query('select count(*)::int n from public.profiles where auth_user_id=$1', [contextFixture.accounts.missingProfile.id])).rows[0].n, 0);
  console.log('PASS query-intent filters, no union business data, and no silent profile provisioning');
} finally {
  if (app) { app.kill(); await new Promise(resolve => app.exitCode !== null ? resolve() : app.once('exit', resolve)); }
  if (gateway) { gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve)); }
  if (api) await api.close();
  if (lab) await lab.close();
}
