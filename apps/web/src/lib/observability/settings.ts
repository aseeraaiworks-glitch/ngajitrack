export type MonitoringSettings = { dsn?: string; environment: 'development' | 'test' | 'production'; release: string };

export function monitoringSettings(env: Record<string, string | undefined>): MonitoringSettings {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
  const environment = env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || (env.NODE_ENV === 'production' ? 'production' : 'development');
  if (!['development', 'test', 'production'].includes(environment)) throw new Error('Invalid monitoring environment.');
  const version = env.NEXT_PUBLIC_SENTRY_RELEASE || '0.1.0';
  if (!/^(?:\d+\.\d+\.\d+(?:-[a-z0-9.]+)?|[a-f0-9]{7,40})$/.test(version)) throw new Error('Invalid monitoring release.');
  if (dsn) {
    let url: URL;
    try { url = new URL(dsn); } catch { throw new Error('Invalid monitoring DSN.'); }
    const localTest = environment === 'test' && url.protocol === 'http:' && url.hostname === '127.0.0.1';
    if ((!localTest && url.protocol !== 'https:') || !/^[a-f0-9]{32}$/.test(url.username) || url.password ||
        !/^\/[1-9]\d*$/.test(url.pathname) || url.search || url.hash) throw new Error('Invalid monitoring DSN.');
  }
  return { dsn, environment: environment as MonitoringSettings['environment'], release: 'ngajitrack-web@' + version };
}

export function publicMonitoringSettings() {
  // Explicit reads are required for Next's public build-time variable replacement.
  return monitoringSettings({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    NODE_ENV: process.env.NODE_ENV,
  });
}
