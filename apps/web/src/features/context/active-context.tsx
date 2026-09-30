'use client';
import { useEffect } from 'react';
import { contextKey, type ApplicationContext } from '@/domain/application-context';
import { useSessionContext } from '@/features/auth/session-provider';
import { savePreference } from './preference';
import { ContextState } from './context-states';
import { StateCard } from '@/components/ui/state-card';

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
  if (state.contextKey !== key) return <ContextState kind="loading" />;
  return <StateCard title={context.roleLabel}>
    <p data-testid="active-institution" className="font-semibold text-ink">{context.institutionName}</p>
    <p className="mt-2" data-testid="active-scope">{context.scopeKind === 'INSTITUTION' ? 'Cakupan seluruh lembaga' :
      context.scopeKind === 'PROGRAMS' ? 'Cakupan program: ' + context.programLabels.join(', ') : 'Sesuai hubungan dan penugasan Anda'}</p>
    <p className="mt-6">Konteks Anda sudah siap. Fitur untuk peran ini akan tersedia pada tahap berikutnya.</p>
  </StateCard>;
}
