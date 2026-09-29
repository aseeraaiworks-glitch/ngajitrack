import Link from 'next/link';
export default function NotFound() { return <main id="main" className="p-10"><h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1><Link href="/app" className="mt-5 inline-block text-brand underline">Kembali ke akun</Link></main>; }
