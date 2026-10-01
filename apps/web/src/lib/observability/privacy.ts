import type { ErrorEvent, Event, EventHint, StackFrame } from '@sentry/nextjs';
import type { MonitoringSettings } from './settings.ts';

export type MonitoringRuntime = 'client' | 'server' | 'edge';
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'AggregateError']);

export function expectedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; status?: unknown; digest?: unknown };
  return value.name === 'AbortError' ||
    (value.name === 'AuthApiError' && [400, 401, 403].includes(Number(value.status))) ||
    (typeof value.digest === 'string' && /^(NEXT_REDIRECT;|NEXT_HTTP_ERROR_FALLBACK;|NEXT_NOT_FOUND$)/.test(value.digest));
}

export function routeTemplate(path: unknown): string {
  if (typeof path !== 'string') return 'unknown';
  const pathname = path.split(/[?#]/, 1)[0];
  if (['/', '/login', '/app', '/app/select-context', '/app/context-options'].includes(pathname)) return pathname;
  if (/^\/app\/i\/[^/]+\/as\/[^/]+$/.test(pathname)) return '/app/i/[institutionId]/as/[membershipId]';
  return 'unknown';
}

function artifact(filename: unknown): string | undefined {
  if (typeof filename !== 'string') return;
  const match = filename.replaceAll('\\', '/').match(/\/(?:_next|\.next)\/(static\/chunks\/[^?#]+|server\/chunks\/[^?#]+)/);
  const path = match?.[1];
  if (!path || path.length > 240 || path.includes('..') || !/^[a-zA-Z0-9_./[\]()-]+\.js$/.test(path)) return;
  return 'app:///_next/' + path;
}

function frame(value: StackFrame): StackFrame {
  // Keep only generated-code coordinates. Drop locals, source snippets, function names and absolute paths.
  const filename = artifact(value.filename);
  return {
    filename: filename ?? '[redacted]',
    ...(Number.isSafeInteger(value.lineno) && value.lineno! > 0 ? { lineno: value.lineno } : {}),
    ...(Number.isSafeInteger(value.colno) && value.colno! >= 0 ? { colno: value.colno } : {}),
    ...(filename ? { in_app: true } : {}),
  };
}

export function privateErrorEvent(event: Event, settings: MonitoringSettings, runtime: MonitoringRuntime, hint?: EventHint): ErrorEvent | null {
  if (event.type || expectedError(hint?.originalException) || !event.exception?.values?.length) return null;
  const images = event.debug_meta?.images?.flatMap(image => {
    if (image.type !== 'sourcemap') return [];
    const code_file = artifact(image.code_file);
    return code_file && image.debug_id && uuid.test(image.debug_id) ? [{ type: 'sourcemap' as const, code_file, debug_id: image.debug_id }] : [];
  }).slice(0, 30);
  return {
    type: undefined,
    ...(event.event_id && /^[a-f\d]{32}$/i.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? { timestamp: event.timestamp } : {}),
    platform: 'javascript', level: 'error', environment: settings.environment, release: settings.release,
    tags: { runtime, route: routeTemplate(event.tags?.route ?? event.contexts?.nextjs?.router_path) },
    exception: { values: event.exception.values.slice(0, 3).map(value => ({
      type: errorTypes.has(value.type ?? '') ? value.type : 'Error', value: 'Unexpected application error',
      mechanism: { type: 'generic', handled: value.mechanism?.handled !== false },
      stacktrace: { frames: (value.stacktrace?.frames ?? []).slice(-30).map(frame) },
    })) },
    ...(images?.length ? { debug_meta: { images } } : {}),
  };
}
