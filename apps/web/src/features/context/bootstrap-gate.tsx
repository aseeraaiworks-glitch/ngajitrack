'use client';
import { useEffect } from 'react';
import { contextPath, selectionDecision, type ApplicationContext } from '@/domain/application-context';
import { readPreference, clearPreference } from './preference';
import { ContextState } from './context-states';

export function BootstrapGate({ contexts, userId }: { contexts: ApplicationContext[]; userId: string }) {
  useEffect(() => {
    const decision = selectionDecision(contexts, readPreference(userId));
    if (decision.invalidPreference) clearPreference(userId);
    if (decision.automatic) window.location.replace(contextPath(decision.automatic));
    else if (contexts.length) window.location.replace('/app/select-context');
  }, [contexts, userId]);
  return <ContextState kind={contexts.length ? 'loading' : 'empty'} />;
}
