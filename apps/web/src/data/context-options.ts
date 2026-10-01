import type { ApplicationContext } from '@/domain/application-context';

export async function fetchContextOptions(userId: string, signal: AbortSignal): Promise<ApplicationContext[]> {
  const response = await fetch('/app/context-options', { signal, cache: 'no-store', credentials: 'same-origin' });
  signal.throwIfAborted();
  if (response.redirected) {
    // Auth can expire during revalidation. Never navigate to a response-controlled URL.
    window.location.replace('/login');
    throw new Error('Session unavailable.');
  }
  if (!response.ok) throw new Error('Context unavailable.');
  const result = await response.json();
  signal.throwIfAborted();
  if (result.userId !== userId || !Array.isArray(result.contexts)) throw new Error('Context unavailable.');
  return result.contexts;
}
