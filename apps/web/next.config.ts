import type { NextConfig } from 'next';
import { publicEnvironment } from './src/lib/environment';
import { withSentryConfig } from '@sentry/nextjs/config';
import { publicMonitoringSettings } from './src/lib/observability/settings';

// Fail at startup/build rather than silently using a different backend.
publicEnvironment();
const monitoring = publicMonitoringSettings();

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
// Upload is an explicit CI-only operation; tokens are never NEXT_PUBLIC or embedded in config.env.
const upload = process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true';
if (upload && (!monitoring.dsn || !process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT)) {
  throw new Error('Source map upload configuration is incomplete.');
}
export default upload ? withSentryConfig(config, {
  org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: monitoring.release }, telemetry: false, silent: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
}) : config;
