import { StateCard } from '@/components/ui/state-card';

export function ContextState({ kind }: { kind: 'loading' | 'switching' | 'empty' | 'error' | 'denied' | 'unavailable' }) {
  if (kind === 'loading') return <p role="status" className="py-6">Memuat konteks Anda…</p>;
  if (kind === 'switching') return <p role="status" className="py-6">Beralih konteks…</p>;
  const content = {
    unavailable: ['Konteks perlu diperiksa kembali', 'Pilih dan periksa kembali konteks untuk melanjutkan. Tampilan sebelumnya sudah dibersihkan.'],
    empty: ['Belum ada konteks yang tersedia', 'Belum ada keanggotaan atau cakupan aktif yang dapat digunakan. Hubungi pengelola lembaga untuk bantuan.'],
    error: ['Konteks belum dapat dimuat', 'Periksa koneksi Anda lalu coba lagi. Akses belum diberikan sampai konteks berhasil diperiksa.'],
    denied: ['Konteks tidak tersedia', 'Anda tidak memiliki akses ke konteks ini, atau aksesnya sudah berakhir.'],
  }[kind];
  return <StateCard title={content[0]} alert={kind !== 'empty'}>
    <p>{content[1]}</p>
    <a className="mt-5 inline-block font-semibold text-brand underline" href="/app">Periksa kembali konteks</a>
  </StateCard>;
}
