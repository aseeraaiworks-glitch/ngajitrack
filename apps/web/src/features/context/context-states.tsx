import { StateCard } from '@/components/ui/state-card';

export function ContextState({ kind }: { kind: 'loading' | 'empty' | 'error' | 'denied' }) {
  if (kind === 'loading') return <p role="status" className="py-6">Memuat konteks Anda…</p>;
  const content = {
    empty: ['Belum ada konteks yang tersedia', 'Belum ada keanggotaan atau cakupan aktif yang dapat digunakan. Hubungi pengelola lembaga untuk bantuan.'],
    error: ['Konteks belum dapat dimuat', 'Periksa koneksi Anda lalu coba lagi. Akses belum diberikan sampai konteks berhasil diperiksa.'],
    denied: ['Konteks tidak tersedia', 'Anda tidak memiliki akses ke konteks ini, atau aksesnya sudah berakhir.'],
  }[kind];
  return <StateCard title={content[0]} alert={kind !== 'empty'}>
    <p>{content[1]}</p>
    <a className="mt-5 inline-block font-semibold text-brand underline" href="/app">Periksa kembali konteks</a>
  </StateCard>;
}
