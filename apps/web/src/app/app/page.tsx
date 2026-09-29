import { authenticatedAccount } from '@/application/authenticated-account';
import { SessionProvider } from '@/features/auth/session-provider';
import { LogoutButton } from '@/features/auth/logout-button';
import { StateCard } from '@/components/ui/state-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Akun' };

export default async function Account() {
  const { userId, profile } = await authenticatedAccount();
  return <SessionProvider key={userId} userId={userId}>
    <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5"><span className="text-xl font-semibold tracking-tight">NgajiTrack</span><LogoutButton /></div></header>
    <main id="main" className="mx-auto max-w-5xl px-6 py-12">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand">Akun Anda</p>
      {profile ? <StateCard title={`Assalamu’alaikum, ${profile.preferredName || profile.fullName}`}>
        <p data-testid="profile-name">{profile.fullName}</p>
        <p className="mt-6">Anda sudah masuk. Pemilihan lembaga dan peran akan tersedia pada tahap berikutnya.</p>
        <span className="mt-6 inline-flex rounded-full bg-soft px-3 py-1 text-xs font-semibold text-brand">Sesi aktif</span>
      </StateCard> : <StateCard title="Akses profil belum tersedia" alert>
        <p>Akun Anda sudah terautentikasi, tetapi profil belum aktif atau tidak tersedia. Hubungi pengelola lembaga untuk bantuan.</p>
      </StateCard>}
    </main>
  </SessionProvider>;
}
