import type { Instrumentation } from 'next';
import { expectedError, routeTemplate } from './lib/observability/privacy';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./lib/observability/server');
  if (process.env.NEXT_RUNTIME === 'edge') await import('./lib/observability/edge');
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (expectedError(error)) return;
  const Sentry = await import('@sentry/nextjs');
  if (!Sentry.getClient()?.getOptions().enabled) return;
  // Do not give the SDK raw headers, path IDs/query values or request content.
  const path = routeTemplate(request.path);
  Sentry.captureRequestError(error, { path, method: request.method, headers: {} }, { ...context, routePath: path });
  await Sentry.flush(2000);
};
