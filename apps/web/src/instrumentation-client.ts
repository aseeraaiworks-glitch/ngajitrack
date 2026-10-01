import * as Sentry from '@sentry/nextjs';
import { monitoringOptions } from './lib/observability/options';
import { publicMonitoringSettings } from './lib/observability/settings';

const settings = publicMonitoringSettings();
if (settings.dsn) Sentry.init({
  ...monitoringOptions(settings, 'client'),
  integrations: [Sentry.globalHandlersIntegration(), Sentry.browserApiErrorsIntegration(), Sentry.dedupeIntegration()],
});
