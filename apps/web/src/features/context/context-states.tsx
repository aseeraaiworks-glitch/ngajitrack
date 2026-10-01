import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/ui/page-states';
import { LoadingState } from '@/components/ui/skeleton';

export function ContextState({ kind }: { kind: 'loading' | 'switching' | 'empty' | 'error' | 'denied' | 'unavailable' }) {
  if (kind === 'loading') return <LoadingState />;
  if (kind === 'switching') return <LoadingState label="Beralih konteks…" />;
  const content = {
    unavailable: ['Konteks perlu diperiksa kembali', 'Pilih dan periksa kembali konteks untuk melanjutkan. Tampilan sebelumnya sudah dibersihkan.'],
    empty: ['Belum ada konteks yang tersedia', 'Belum ada keanggotaan atau cakupan aktif yang dapat digunakan. Hubungi pengelola lembaga untuk bantuan.'],
    error: ['Konteks belum dapat dimuat', 'Periksa koneksi Anda lalu coba lagi. Akses belum diberikan sampai konteks berhasil diperiksa.'],
    denied: ['Konteks tidak tersedia', 'Anda tidak memiliki akses ke konteks ini, atau aksesnya sudah berakhir.'],
  }[kind];
  const State = kind === 'empty' ? EmptyState : kind === 'denied' ? PermissionDeniedState : ErrorState;
  return <State title={content[0]}>
    <p>{content[1]}</p>
    <a className="mt-5 inline-block font-semibold text-brand underline" href="/app">Periksa kembali konteks</a>
  </State>;
}
