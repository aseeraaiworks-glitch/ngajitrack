'use client';
import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { contextKey, contextPath, selectionDecision, type ApplicationContext } from '@/domain/application-context';
import { readPreference, clearPreference, subscribePreference } from './preference';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';

export function ContextChooser({ contexts, userId }: { contexts: ApplicationContext[]; userId: string }) {
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const stored = useSyncExternalStore(subscribePreference, () => readPreference(userId), () => null);
  const decision = selectionDecision(contexts, stored);
  const selected = chosenKey ?? (decision.preferred ? contextKey(decision.preferred) : '');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (decision.invalidPreference) clearPreference(userId);
  }, [decision.invalidPreference, userId]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = contexts.find(c => contextKey(c) === selected);
    if (!chosen || pending) return;
    setPending(true);
    // Full navigation: no prior-context router cache or in-flight UI request is reused.
    // The destination verifies both URL IDs again with a fresh server bootstrap.
    window.location.assign(contextPath(chosen));
  }
  return <StateCard title="Pilih konteks Anda">
    <p>Pilih lembaga dan peran yang ingin Anda gunakan.</p>
    <form className="mt-6 space-y-5" onSubmit={submit}>
      <fieldset disabled={pending} className="space-y-3">
        <legend className="sr-only">Lembaga dan peran</legend>
        {contexts.map(context => <label key={contextKey(context)} className="flex cursor-pointer items-start gap-4 rounded-control border border-line p-4 has-checked:border-brand has-checked:bg-soft">
          <input className="mt-1 size-4 accent-brand" type="radio" name="context" value={contextKey(context)}
            checked={selected === contextKey(context)} onChange={() => setChosenKey(contextKey(context))} />
          <span><span className="block font-semibold text-ink">{context.institutionName} · {context.roleLabel}</span>
            <span className="block text-sm">{context.scopeKind === 'INSTITUTION' ? 'Seluruh lembaga' : context.scopeKind === 'PROGRAMS' ? context.programLabels.join(', ') : 'Sesuai hubungan dan penugasan Anda'}</span>
          </span>
        </label>)}
      </fieldset>
      <Button type="submit" disabled={!selected || pending}>{pending ? 'Membuka konteks…' : 'Gunakan konteks'}</Button>
    </form>
  </StateCard>;
}
