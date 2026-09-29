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
let lab, api, gateway, app;
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
    const upstream = route.startsWith('/auth/v1/') ? api.auth + route.slice(8) : route.startsWith('/rest/v1/') ? api.rest + route.slice(8) : null;
    if (!upstream) { res.writeHead(404); res.end(); return; }
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
  };
  await child(next, ['build'], env);
  app = child(next, ['start', '--hostname', '127.0.0.1', '--port', String(port)], env, true);
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch(env.NGT_WEB_TEST_URL + '/login')).ok) { ready = true; break; } } catch {} await setTimeout(500); }
  if (!ready) throw Error('Production web server did not start');
  await child(playwright, ['test'], env);
} finally {
  if (app) { app.kill(); await new Promise(resolve => app.exitCode !== null ? resolve() : app.once('exit', resolve)); }
  if (gateway) { gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve)); }
  if (api) await api.close();
  if (lab) await lab.close();
}
