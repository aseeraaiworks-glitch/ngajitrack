'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { contextKey, contextPath, resolveContext, sameContextScope, type ApplicationContext } from '@/domain/application-context';
import { LatestRequest } from '@/application/latest-request';
import { fetchContextOptions } from '@/data/context-options';
import { useSessionContext } from '@/features/auth/session-provider';
import { clearPreference } from './preference';
import { ContextSelector } from './context-selector';
import { ContextState } from './context-states';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export function ContextSwitcher({ context, userId, children, render }: {
  context: ApplicationContext; userId: string; children: ReactNode;
  render?: (trigger: ReactNode, content: ReactNode) => ReactNode;
}) {
  const { dispatch } = useSessionContext();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const requests = useRef(new LatestRequest());
  const [options, setOptions] = useState<ApplicationContext[]>([]);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'switching' | 'error'>('idle');
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const pending = requests.current;
    return () => pending.cancel();
  }, []);
  function invalidate() {
    dispatch({ type: 'context', key: null });
    clearPreference(userId);
    setUnavailable(true);
  }
  async function open() {
    const request = requests.current.begin();
    setPhase('loading'); setOptions([]); setMessage('');
    dialog.current?.showModal();
    try {
      const fresh = await fetchContextOptions(userId, request.signal);
      if (!request.current()) return;
      setOptions(fresh); setPhase('ready');
      const current = resolveContext(fresh, context);
      // A partial scope change also invalidates the old aggregate presentation.
      if (!current || !sameContextScope(current, context)) invalidate();
    } catch {
      if (!request.current()) return;
      invalidate(); setPhase('error');
    }
  }
  function close() {
    requests.current.cancel();
    setPhase('idle');
    dialog.current?.close();
    trigger.current?.focus();
  }
  async function select(chosen: ApplicationContext) {
    const request = requests.current.begin();
    // Hide and discard prior-context presentation immediately, including late reducer payloads.
    invalidate(); setPhase('switching'); setMessage('');
    try {
      const fresh = await fetchContextOptions(userId, request.signal);
      if (!request.current()) return;
      const next = resolveContext(fresh, chosen);
      if (!next) {
        setOptions(fresh); setPhase('ready');
        setMessage('Pilihan tidak lagi tersedia. Pilih konteks lain.');
        return;
      }
      // Fresh document discards all old in-flight requests/router state. The destination
      // validates again to handle a revoke between this response and navigation.
      window.location.assign(contextPath(next));
    } catch {
      if (!request.current()) return;
      setPhase('error');
    }
  }
  const control = <Button ref={trigger} variant="secondary" aria-haspopup="dialog" onClick={open}>Ganti konteks</Button>;
  const content = unavailable ? <ContextState kind={phase === 'switching' ? 'switching' : 'unavailable'} /> : children;
  return <>
    {render ? render(control, content) : <><div className="mb-4 flex justify-end">{control}</div>{content}</>}
    <Dialog ref={dialog} title="Ganti konteks" onDismiss={close}>
      {phase === 'loading' && <ContextState kind="loading" />}
      {phase === 'switching' && <ContextState kind="switching" />}
      {phase === 'error' && <div className="mt-5 space-y-4"><p role="alert">Konteks belum dapat diperiksa. Coba lagi setelah koneksi tersedia.</p><Button onClick={open}>Coba lagi</Button></div>}
      {message && <p role="alert" className="mt-4">{message}</p>}
      {phase === 'ready' && (options.length ? <ContextSelector key={options.map(contextKey).join('|') + message}
        contexts={options} initial={resolveContext(options, context)} onSelect={select} submitLabel="Pindah konteks" /> :
        <p role="status" className="mt-5">Belum ada konteks yang tersedia. Hubungi pengelola lembaga.</p>)}
    </Dialog>
  </>;
}
