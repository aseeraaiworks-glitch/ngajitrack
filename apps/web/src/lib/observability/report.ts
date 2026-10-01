import * as Sentry from '@sentry/nextjs';
import { expectedError } from './privacy';

export function reportUnexpected(error: unknown) {
  if (expectedError(error) || !Sentry.getClient()?.getOptions().enabled) return;
  Sentry.captureException(error);
}
