'use client';
import { useEffect } from 'react';
import { contextKey, type ApplicationContext } from '@/domain/application-context';
import { useSessionContext } from '@/features/auth/session-provider';
import { savePreference } from './preference';
import { ContextState } from './context-states';
import { CurrentContextLabel } from './current-context-label';
import { ContextSwitcher } from './context-switcher';

export function ActiveContext({ context, userId }: { context: ApplicationContext; userId: string }) {
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
  return <ContextSwitcher context={context} userId={userId}>
    {state.contextKey === key ? <CurrentContextLabel context={context} /> : <ContextState kind="loading" />}
  </ContextSwitcher>;
}
