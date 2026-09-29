'use client';
import { Button } from '@/components/ui/button';
import { StateCard } from '@/components/ui/state-card';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main" className="mx-auto max-w-xl px-6 py-16"><StateCard title="Belum dapat memuat halaman" alert>
    <p>Periksa koneksi Anda dan coba lagi. Jika masalah berlanjut, hubungi pengelola lembaga.</p>
    <Button className="mt-6" onClick={reset}>Coba lagi</Button>
  </StateCard></main>;
}
