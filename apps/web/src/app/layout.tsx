import type { Metadata } from 'next';
import { ConnectionStatus } from '@/features/shell/connection-status';
import '@/styles/globals.css';

export const metadata: Metadata = { title: { default: 'NgajiTrack', template: '%s · NgajiTrack' }, description: 'Ruang belajar yang terhubung.', robots: { index: false, follow: false } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="min-h-dvh font-sans antialiased">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-4">Langsung ke konten</a>
    <ConnectionStatus />{children}
  </body></html>;
}
