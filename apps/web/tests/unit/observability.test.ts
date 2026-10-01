import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Event } from '@sentry/nextjs';
import { monitoringSettings } from '../../src/lib/observability/settings.ts';
import { expectedError, privateErrorEvent, routeTemplate } from '../../src/lib/observability/privacy.ts';
import { errorOnlyTransport, monitoringOptions } from '../../src/lib/observability/options.ts';

const settings = monitoringSettings({ NODE_ENV: 'test', NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'test' });
const error: Event = { exception: { values: [{ type: 'TypeError', value: 'private form value', stacktrace: { frames: [
  { filename: 'https://app.example.invalid/_next/static/chunks/abc123.js?token=private', lineno: 20, colno: 3,
    function: 'private name', vars: { password: 'private' }, context_line: 'private source' },
  { filename: 'C:\\Users\\Private Person\\notes.txt', lineno: 1 },
] } }] } };

test('monitoring is optional and has explicit environment/release with no secret defaults', () => {
  assert.equal(settings.dsn, undefined);
  assert.equal(monitoringOptions(settings, 'client').enabled, false);
  assert.equal(settings.environment, 'test');
  assert.equal(monitoringSettings({ NODE_ENV: 'production' }).environment, 'production');
  assert.equal(monitoringSettings({ NODE_ENV: 'development' }).environment, 'development');
  assert.throws(() => monitoringSettings({ NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'person@example.invalid' }), /Invalid monitoring environment/);
  assert.throws(() => monitoringSettings({ NEXT_PUBLIC_SENTRY_RELEASE: 'private@example.invalid' }), /Invalid monitoring release/);
});
test('DSN validation rejects credentials, query strings and unsafe non-test HTTP without echoing input', () => {
  const key = randomBytes(16).toString('hex');
  const base = `https://${key}@ingest.example.invalid/1`;
  assert.equal(monitoringSettings({ NEXT_PUBLIC_SENTRY_DSN: base }).dsn, base);
  for (const dsn of [base + '?password=private', base + '#private', base.replace('@', ':private@'), base.replace('https:', 'http:'), 'private']) {
    assert.throws(() => monitoringSettings({ NEXT_PUBLIC_SENTRY_DSN: dsn }), { message: 'Invalid monitoring DSN.' });
  }
  assert.throws(() => monitoringSettings({ NEXT_PUBLIC_SENTRY_DSN: `http://${key}@localhost/1`, NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'test' }));
});
test('privacy allowlist removes all PII, free-text, headers, cookies, bodies and arbitrary context', () => {
  const event: Event = { ...error, message: 'private name', user: { id: 'private', email: 'private@example.invalid', ip_address: 'private' },
    request: { url: 'https://private.invalid?access_token=private', headers: { Authorization: 'private' }, cookies: { auth: 'private' }, data: { password: 'private' } },
    extra: { phone: 'private', full_name: 'private', memorization: 'private', quran: 'private', service_role: 'private' },
    breadcrumbs: [{ message: 'private', data: { refresh_token: 'private' } }], contexts: { custom: { body: 'private' } },
    tags: { email: 'private', route: '/app/i/private/as/private?program=private' }, transaction: 'private', fingerprint: ['private'], server_name: 'private', modules: { private: 'private' },
  };
  const result = privateErrorEvent(event, settings, 'server')!;
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.equal(result.tags?.route, '/app/i/[institutionId]/as/[membershipId]');
  assert.equal(result.exception!.values![0].stacktrace!.frames![0].filename, 'app:///_next/static/chunks/abc123.js');
  assert.equal(result.exception!.values![0].stacktrace!.frames![1].filename, '[redacted]');
  assert.equal(result.exception!.values![0].value, 'Unexpected application error');
  assert.deepEqual(privateErrorEvent(result, settings, 'server'), result, 'wire sanitization is idempotent');
});
test('expected control flow/auth/abort errors and non-error telemetry are excluded', () => {
  for (const originalException of [{ name: 'AbortError' }, { name: 'AuthApiError', status: 400 }, { digest: 'NEXT_REDIRECT;private' }, { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }]) {
    assert.ok(expectedError(originalException));
    assert.equal(privateErrorEvent(error, settings, 'client', { originalException }), null);
  }
  assert.equal(expectedError({ name: 'AuthApiError', status: 503 }), false);
  assert.equal(privateErrorEvent({ type: 'transaction', ...error }, settings, 'client'), null);
  assert.equal(privateErrorEvent({ message: 'permission denied' }, settings, 'client'), null);
  assert.ok(privateErrorEvent(error, settings, 'client', { originalException: new TypeError('unexpected') }));
});
test('route metadata never includes tenant IDs, query data or arbitrary URLs', () => {
  assert.equal(routeTemplate('/app/i/tenant/as/member?password=private'), '/app/i/[institutionId]/as/[membershipId]');
  assert.equal(routeTemplate('/login?email=private'), '/login');
  assert.equal(routeTemplate('/private/phone'), 'unknown');
  assert.equal(routeTemplate('https://private.invalid/login'), 'unknown');
});
test('replay, tracing, logs, metrics, sessions, breadcrumbs and client reports stay disabled', () => {
  const options = monitoringOptions(settings, 'client');
  for (const key of ['sendDefaultPii', 'defaultIntegrations', 'debug', 'sendClientReports', 'enableLogs', 'enableMetrics', 'autoSessionTracking'] as const) assert.equal(options[key], false);
  assert.equal(options.tracesSampleRate, 0); assert.equal(options.replaysSessionSampleRate, 0); assert.equal(options.replaysOnErrorSampleRate, 0);
  assert.equal(options.maxBreadcrumbs, 0); assert.equal(options.beforeBreadcrumb(), null); assert.deepEqual(options.tracePropagationTargets, []);
});
test('source-map debug IDs survive without absolute paths, snippet source or private metadata', () => {
  const result = privateErrorEvent({ ...error, debug_meta: { images: [{ type: 'sourcemap', code_file: 'https://private.invalid/_next/static/chunks/a123.js?private', debug_id: '11111111-1111-4111-a111-111111111111' }] } }, settings, 'client')!;
  assert.equal(result.debug_meta?.images?.length, 1);
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('final transport drops SDK-added data and all non-error envelope items before HTTP', async () => {
  const bodies: string[] = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.cookie, undefined); assert.equal(req.headers.authorization, undefined); assert.equal(req.headers.referer, undefined);
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    bodies.push(Buffer.concat(chunks).toString()); res.end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const transport = errorOnlyTransport(settings, 'client')({ url: `http://127.0.0.1:${address.port}`, recordDroppedEvent: () => {} });
    const id = randomBytes(16).toString('hex');
    await transport.send([{ event_id: id, sent_at: 'private', trace: { transaction: 'private' } }, [
      [{ type: 'event' }, { ...error, user: { email: 'private@example.invalid' }, extra: { token: 'private' } }],
      [{ type: 'attachment', length: 7, filename: 'private' }, 'private'],
    ]]);
    await transport.flush(1000);
    assert.equal(bodies.length, 1); assert.ok(!bodies[0].includes('private'));
    assert.equal(bodies[0].trim().split('\n').length, 3);
    assert.equal(JSON.parse(bodies[0].split('\n')[2]).tags.runtime, 'client');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
