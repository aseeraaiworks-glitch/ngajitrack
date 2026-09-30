import type { ReactNode } from 'react';
import type { AuthenticatedProfile } from '@/domain/auth';
import { SessionProvider } from '@/features/auth/session-provider';
import { LogoutButton } from '@/features/auth/logout-button';
import { StateCard } from '@/components/ui/state-card';
import { ValidatePreference } from '@/features/context/validate-preference';

export function AccountShell({ userId, profile, children }: { userId: string; profile: AuthenticatedProfile | null; children: ReactNode }) {
  return <SessionProvider key={userId} userId={userId}>
    <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
      <span className="text-xl font-semibold tracking-tight">NgajiTrack</span><LogoutButton />
    </div></header>
    <main id="main" className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      {profile ? <>
        <div><p className="text-sm font-semibold uppercase tracking-widest text-brand">Akun Anda</p>
          <p data-testid="profile-name" className="mt-2 text-lg font-semibold">{profile.fullName}</p></div>
        {children}
      </> : <StateCard title="Akses profil belum tersedia" alert>
        <ValidatePreference contexts={[]} userId={userId} />
        <p>Akun Anda sudah terautentikasi, tetapi profil belum aktif atau tidak tersedia. Hubungi pengelola lembaga untuk bantuan.</p>
      </StateCard>}
    </main>
  </SessionProvider>;
}
