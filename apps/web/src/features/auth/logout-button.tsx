'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { useSessionContext } from './session-provider';
import { clearPreference } from '@/features/context/preference';

export function LogoutButton() {
  const { state, dispatch } = useSessionContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setPending(true); setError('');
    try {
      const { error } = await browserClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      if (state.userId) clearPreference(state.userId);
      dispatch({ type: 'clear' });
      window.location.replace('/login');
    } catch {
      setError('Belum dapat keluar. Periksa koneksi lalu coba lagi.');
      setPending(false);
    }
  }
  return <div className="space-y-2">
    <Button variant="secondary" onClick={logout} disabled={pending}>{pending ? 'Keluar…' : 'Keluar'}</Button>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
