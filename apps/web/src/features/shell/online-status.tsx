'use client';
import { useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';

function subscribe(update: () => void) {
  window.addEventListener('online', update); window.addEventListener('offline', update);
  return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
}
export function useOnline() { return useSyncExternalStore(subscribe, () => navigator.onLine, () => true); }
export function OnlineStatus() {
  const online = useOnline();
  return <span data-testid="online-status" aria-live="polite" title="Koneksi perangkat; bukan status sinkronisasi data.">
    <Badge tone={online ? 'success' : 'warning'}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{online ? 'Online' : 'Offline'}</Badge>
  </span>;
}
