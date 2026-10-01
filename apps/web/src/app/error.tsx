'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/page-states';
import { reportUnexpected } from '@/lib/observability/report';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry?: () => void }) {
  useEffect(() => { reportUnexpected(error); }, [error]);
  return <main id="main" className="mx-auto max-w-xl px-6 py-16"><ErrorState title="Belum dapat memuat halaman">
    <p>Periksa koneksi Anda dan coba lagi. Jika masalah berlanjut, hubungi pengelola lembaga.</p>
    {/* Next retry refreshes server data; reset alone reuses the failed RSC payload. */}
    <Button className="mt-6" onClick={() => retry ? retry() : window.location.reload()}>Coba lagi</Button>
  </ErrorState></main>;
}
