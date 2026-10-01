import type { ReactNode } from 'react';
import type { AuthenticatedProfile } from '@/domain/auth';
import { SessionProvider } from '@/features/auth/session-provider';
import { StateCard } from '@/components/ui/state-card';
import { ValidatePreference } from '@/features/context/validate-preference';
import { AppShell } from './app-shell';
import type { ApplicationContext } from '@/domain/application-context';

export function AccountShell({ userId, profile, children, context = null }: { userId: string; profile: AuthenticatedProfile | null; children: ReactNode; context?: ApplicationContext | null }) {
  return <SessionProvider key={userId} userId={userId}>
    <AppShell userId={userId} profile={profile} context={profile ? context : null}>
      {profile ? children : <StateCard title="Akses profil belum tersedia" alert>
        <ValidatePreference contexts={[]} userId={userId} />
        <p>Akun Anda sudah terautentikasi, tetapi profil belum aktif atau tidak tersedia. Hubungi pengelola lembaga untuk bantuan.</p>
      </StateCard>}
    </AppShell>
  </SessionProvider>;
}
