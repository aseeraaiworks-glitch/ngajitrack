// Read local Supabase metadata in memory; forward only the public URL/key.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const web = new URL('apps/web/', root);
const require = createRequire(new URL('package.json', web));
const operation = process.argv[2] ?? 'dev';
if (!['dev', 'build', 'typegen'].includes(operation)) throw Error('Unsupported local web command');
let runtime;
try {
  runtime = JSON.parse(execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'], { cwd: fileURLToPath(root), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
} catch { throw Error('Local Supabase is unavailable. Start Docker and the existing local stack first.'); }
const api = new URL(runtime.API_URL);
if (!['127.0.0.1', 'localhost'].includes(api.hostname)) throw Error('Expected local Supabase');
if (!runtime.PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw Error('Local Supabase publishable key is unavailable');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), operation, ...(operation === 'dev' ? ['--hostname', '127.0.0.1'] : [])], {
  cwd: fileURLToPath(web), windowsHide: true, stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: api.origin, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: runtime.PUBLISHABLE_KEY, NEXT_TELEMETRY_DISABLED: '1' },
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', () => { process.exitCode = 1; });
