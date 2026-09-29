'use client';
import { useState, type FormEvent } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { loginError, safeDestination } from '@/domain/auth';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

export function LoginForm({ destination }: { destination: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError('');
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get('email')).trim(), password: String(form.get('password')),
      });
      if (error) { setError(loginError(error.status)); setPending(false); return; }
      // A full navigation discards all presentation state from a previous account.
      window.location.replace(safeDestination(destination));
    } catch { setError(loginError()); setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
    <Field label="Email" id="email" name="email" type="email" autoComplete="username" placeholder="nama@lembaga.id" required disabled={pending} />
    <Field label="Kata sandi" id="password" name="password" type="password" autoComplete="current-password" required disabled={pending} aria-describedby={error ? 'login-error' : undefined} />
    {error && <p id="login-error" role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    <Button className="w-full" type="submit" disabled={pending}>{pending ? 'Sedang masuk…' : 'Masuk'}</Button>
  </form>;
}
