'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Tone } from './badge';
import { Button } from './button';

type Notice = { id: number; message: string; tone: Tone };
const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);
export function Toast({ notice, dismiss }: { notice: Notice; dismiss: () => void }) {
  return <div className="pointer-events-auto flex animate-toast items-center gap-4 rounded-control border border-line bg-surface p-4 text-sm text-ink shadow-overlay"
    role={notice.tone === 'error' ? 'alert' : 'status'}>
    <p className="min-w-0 flex-1">{notice.message}</p>
    <Button variant="secondary" className="shrink-0 px-3" aria-label="Tutup notifikasi" onClick={dismiss}>Tutup</Button>
  </div>;
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = ++nextId.current;
    setNotices(previous => [...previous.slice(-2), { id, message, tone }]);
    const timer = setTimeout(() => { setNotices(previous => previous.filter(n => n.id !== id)); timers.current.delete(timer); }, 8000);
    timers.current.add(timer);
  }, []);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { activeTimers.forEach(clearTimeout); activeTimers.clear(); };
  }, []);
  return <ToastContext.Provider value={show}>{children}
    <aside aria-label="Notifikasi" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto grid max-w-md gap-3 sm:left-auto sm:right-6 sm:mx-0">
      {notices.map(notice => <Toast key={notice.id} notice={notice} dismiss={() => setNotices(previous => previous.filter(n => n.id !== notice.id))} />)}
    </aside>
  </ToastContext.Provider>;
}
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('ToastProvider is required.');
  return show;
}
