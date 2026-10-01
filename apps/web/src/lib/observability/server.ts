import * as Sentry from '@sentry/nextjs';
import { monitoringOptions } from './options';
import { publicMonitoringSettings } from './settings';

const settings = publicMonitoringSettings();
if (settings.dsn) Sentry.init({
  ...monitoringOptions(settings, 'server'), enableOpenTelemetrySetup: false,
  integrations: [Sentry.onUnhandledRejectionIntegration(), Sentry.onUncaughtExceptionIntegration()],
});
