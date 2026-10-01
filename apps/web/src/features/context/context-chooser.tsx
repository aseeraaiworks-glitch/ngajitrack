'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { contextPath, selectionDecision, type ApplicationContext } from '@/domain/application-context';
import { readPreference, clearPreference, subscribePreference } from './preference';
import { StateCard } from '@/components/ui/state-card';
import { ContextSelector } from './context-selector';

export function ContextChooser({ contexts, userId }: { contexts: ApplicationContext[]; userId: string }) {
  const stored = useSyncExternalStore(subscribePreference, () => readPreference(userId), () => null);
  const decision = selectionDecision(contexts, stored);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (decision.invalidPreference) clearPreference(userId);
  }, [decision.invalidPreference, userId]);
  function submit(chosen: ApplicationContext) {
    if (pending) return;
    setPending(true);
    // Full navigation: no prior-context router cache or in-flight UI request is reused.
    // The destination verifies both URL IDs again with a fresh server bootstrap.
    window.location.assign(contextPath(chosen));
  }
  return <StateCard title="Pilih konteks Anda">
    <p>Pilih lembaga dan peran yang ingin Anda gunakan.</p>
    <ContextSelector key={stored ?? 'no-preference'} contexts={contexts} initial={decision.preferred} pending={pending} onSelect={submit} />
  </StateCard>;
}
