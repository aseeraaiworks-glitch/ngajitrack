'use client';
import { useEffect } from 'react';
import { useOnline } from './online-status';
import { useToast } from '@/components/ui/toast';

export function ConnectionStatus() {
  const online = useOnline();
  const showToast = useToast();
  useEffect(() => {
    let previous = navigator.onLine;
    const update = () => {
      if (!previous && navigator.onLine) showToast('Terhubung kembali. Muat ulang halaman untuk memeriksa data terbaru.');
      previous = navigator.onLine;
    };
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [showToast]);
  return !online ? <p role="status" data-testid="offline-warning" className="bg-warning-soft px-5 py-3 text-center text-sm text-warning">Anda sedang offline. Koneksi terputus. Sinkronisasi offline belum tersedia.</p> : null;
}
