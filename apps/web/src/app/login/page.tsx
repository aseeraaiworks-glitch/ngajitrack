import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { LoginForm } from '@/features/auth/login-form';
import { safeDestination } from '@/domain/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Masuk' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const destination = safeDestination((await searchParams).next);
  const { data: { user } } = await (await serverClient()).auth.getUser();
  if (user) redirect(destination);
  return <main id="main" className="mx-auto flex min-h-dvh max-w-6xl items-center px-6 py-12 sm:px-10">
    <div className="grid w-full gap-12 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div className="animate-enter">
        <div className="mb-10 inline-flex items-center gap-3 text-xl font-semibold tracking-tight"><span aria-hidden="true" className="flex size-10 items-center justify-center rounded-control bg-brand text-on-brand">N</span>NgajiTrack</div>
        <p className="mb-4 text-sm font-semibold uppercase tracking-[.18em] text-brand">Belajar · Terhubung · Bertumbuh</p>
        <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Satu akun.<br /><span className="text-brand">Setiap peran berarti.</span></h1>
        <p className="mt-6 max-w-md text-base leading-7 text-muted">Selamat datang kembali di ruang belajar Anda. Masuk untuk melanjutkan perjalanan bersama NgajiTrack.</p>
      </div>
      <section aria-labelledby="login-title" className="animate-enter rounded-card border border-line bg-surface p-7 shadow-card sm:p-10">
        <h2 id="login-title" className="text-2xl font-semibold tracking-tight">Masuk ke akun Anda</h2>
        <p className="mb-8 mt-2 text-sm leading-6 text-muted">Gunakan email dan kata sandi akun yang sudah terdaftar.</p>
        <LoginForm destination={destination} />
        <p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-muted">Belum memiliki akses? Hubungi pengelola lembaga Anda.</p>
      </section>
    </div>
  </main>;
}
