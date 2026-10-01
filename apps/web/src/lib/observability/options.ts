import { createTransport, type Event, type Transport, type BaseTransportOptions } from '@sentry/core';
import { privateErrorEvent, type MonitoringRuntime } from './privacy.ts';
import type { MonitoringSettings } from './settings.ts';

export function errorOnlyTransport(settings: MonitoringSettings, runtime: MonitoringRuntime) {
  return (options: BaseTransportOptions): Transport => {
    const transport = createTransport(options, async request => {
      const response = await fetch(options.url, {
        method: 'POST', body: request.body as BodyInit, headers: { 'Content-Type': 'text/plain' },
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      return { statusCode: response.status, headers: { 'x-sentry-rate-limits': response.headers.get('x-sentry-rate-limits'), 'retry-after': response.headers.get('retry-after') } };
    });
    return {
      flush: timeout => transport.flush(timeout),
      send(envelope) {
        // Final wire boundary: SDK-added metadata, attachments, sessions, traces and logs never leave.
        const items: [{ type: 'event' }, Event][] = [];
        for (const [header, payload] of envelope[1]) {
          if (header.type !== 'event' || typeof payload !== 'object' || payload === null) continue;
          const event = privateErrorEvent(payload as Event, settings, runtime);
          if (event) items.push([{ type: 'event' }, event]);
        }
        if (!items.length) return Promise.resolve({});
        const id = envelope[0].event_id;
        if (typeof id !== 'string' || !/^[a-f\d]{32}$/i.test(id)) return Promise.resolve({});
        return transport.send([{ sent_at: new Date().toISOString(), event_id: id }, items]);
      },
    };
  };
}

export function monitoringOptions(settings: MonitoringSettings, runtime: MonitoringRuntime) {
  return {
    dsn: settings.dsn, enabled: !!settings.dsn, environment: settings.environment, release: settings.release,
    sendDefaultPii: false, defaultIntegrations: false as const, debug: false, maxBreadcrumbs: 0,
    sendClientReports: false, enableLogs: false, enableMetrics: false, autoSessionTracking: false,
    tracesSampleRate: 0, tracePropagationTargets: [], replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: (event: Parameters<typeof privateErrorEvent>[0], hint: Parameters<typeof privateErrorEvent>[3]) => privateErrorEvent(event, settings, runtime, hint),
    transport: errorOnlyTransport(settings, runtime),
  };
}
