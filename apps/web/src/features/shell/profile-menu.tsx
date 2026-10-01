'use client';
import { useRef } from 'react';
import type { AuthenticatedProfile } from '@/domain/auth';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';

export function ProfileMenu({ profile }: { profile: AuthenticatedProfile | null }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const name = profile?.fullName ?? 'Akun Anda';
  return <>
    <button ref={trigger} aria-label="Buka profil akun" aria-haspopup="dialog" className="motion-control flex min-h-12 min-w-0 items-center gap-3 rounded-control px-1 py-1 text-left transition-colors hover:bg-soft"
      onClick={() => dialog.current?.showModal()}>
      <Avatar name={name} />
      {profile && <span className="max-w-24 truncate text-sm font-semibold sm:max-w-48" data-testid="profile-name">{name}</span>}
    </button>
    <Dialog ref={dialog} title="Profil akun" onDismiss={() => { dialog.current?.close(); trigger.current?.focus(); }}>
      <div className="mt-6 flex items-center gap-4"><Avatar name={name} /><p className="min-w-0 break-words font-semibold">{name}</p></div>
      <p className="mt-5 leading-7 text-muted">Satu akun untuk setiap peran Anda. Pilih konteks yang sesuai untuk berpindah lembaga atau peran.</p>
    </Dialog>
  </>;
}
