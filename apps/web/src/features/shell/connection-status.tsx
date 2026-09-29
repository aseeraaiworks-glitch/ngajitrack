'use client';
import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return offline ? <p role="status" className="border-b border-line bg-soft px-5 py-3 text-center text-sm text-warning">Anda sedang offline. Masuk dan memuat data memerlukan koneksi internet.</p> : null;
}
