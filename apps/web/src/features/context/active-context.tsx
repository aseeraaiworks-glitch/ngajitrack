'use client';
import { useEffect, type ReactNode } from 'react';
import { contextKey, type ApplicationContext } from '@/domain/application-context';
import { useSessionContext } from '@/features/auth/session-provider';
import { savePreference } from './preference';
import { ContextState } from './context-states';
import { CurrentContextLabel } from './current-context-label';

export function ActiveContext({ context, userId, children }: { context: ApplicationContext; userId: string; children?: ReactNode }) {
  const { state, dispatch } = useSessionContext();
  const key = contextKey(context);
  useEffect(() => {
    dispatch({ type: 'context', key });
    savePreference(userId, context);
    // Expiry must trigger fresh server validation even while the page stays open.
    const timer = context.revalidateAt ? window.setInterval(() => {
      if (Date.now() >= Date.parse(context.revalidateAt!)) {
        dispatch({ type: 'context', key: null });
        window.location.replace('/app');
      }
    }, 1000) : undefined;
    return () => { if (timer !== undefined) window.clearInterval(timer); };
  }, [context, dispatch, key, userId]);
  return state.contextKey === key ? children ?? <CurrentContextLabel context={context} /> : <ContextState kind="loading" />;
}
