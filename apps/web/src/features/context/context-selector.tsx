'use client';
import { useId, useState, type FormEvent } from 'react';
import { contextKey, findContext, resolveContext, type ApplicationContext, type ContextReference } from '@/domain/application-context';
import { Button } from '@/components/ui/button';

export function ContextSelector({ contexts, initial, pending = false, onSelect, submitLabel = 'Gunakan konteks' }: {
  contexts: ApplicationContext[]; initial?: ContextReference | null; pending?: boolean;
  onSelect: (context: ApplicationContext) => void; submitLabel?: string;
}) {
  const scopeId = useId();
  const [selection, setSelection] = useState<ContextReference | null>(initial ?? null);
  const membership = selection ? findContext(contexts, selection.institutionId, selection.membershipId) : null;
  const selected = selection ? resolveContext(contexts, selection) : null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected && !pending) onSelect(selected);
  }
  return <form className="mt-6 space-y-5" onSubmit={submit}>
    <fieldset disabled={pending} className="space-y-3">
      <legend className="sr-only">Lembaga dan peran</legend>
      {contexts.map(context => <label key={contextKey(context)} className="flex cursor-pointer items-start gap-4 rounded-control border border-line p-4 has-checked:border-brand has-checked:bg-soft">
        <input className="mt-1 size-4 accent-brand" type="radio" name="context" value={contextKey(context)}
          checked={membership?.membershipId === context.membershipId && membership.institutionId === context.institutionId}
          onChange={() => setSelection(context)} />
        <span><span className="block font-semibold text-ink">{context.institutionName} · {context.roleLabel}</span>
          <span className="block text-sm">{context.scopeKind === 'INSTITUTION' ? 'Seluruh lembaga' : context.scopeKind === 'PROGRAMS' ? context.programLabels.join(', ') : 'Sesuai hubungan dan penugasan Anda'}</span>
        </span>
      </label>)}
      {membership?.scopeKind === 'PROGRAMS' && <div className="space-y-2 font-semibold text-ink">
        <label htmlFor={scopeId}>Cakupan program</label>
        <select id={scopeId} className="block min-h-12 w-full rounded-control border border-line bg-surface px-3" value={selection?.programId ?? ''}
          onChange={event => setSelection({ institutionId: membership.institutionId, membershipId: membership.membershipId,
            ...(event.target.value ? { programId: event.target.value } : {}) })}>
          <option value="">Semua program yang ditugaskan</option>
          {membership.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>}
    </fieldset>
    <Button type="submit" disabled={!selected || pending}>{pending ? 'Memeriksa pilihan…' : submitLabel}</Button>
  </form>;
}
