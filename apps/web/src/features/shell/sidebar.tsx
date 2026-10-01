import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { NavigationEntry } from '@/domain/navigation';
import { NavigationItem } from './navigation-item';

export function Sidebar({ items, collapsed, onToggle }: { items: NavigationEntry[]; collapsed: boolean; onToggle: () => void }) {
  return <aside className="sticky top-0 hidden h-dvh min-w-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex" aria-label="Panel navigasi">
    <a href="/app" aria-label="NgajiTrack, beranda akun" className={`flex min-h-12 items-center gap-3 px-2 ${collapsed ? 'justify-center' : ''}`}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-brand text-xl font-semibold text-on-brand">N</span>
      {!collapsed && <span className="text-lg font-semibold tracking-tight">NgajiTrack</span>}
    </a>
    <div className="mt-10 flex-1">
      {!collapsed && <p className="mb-3 px-3 text-caption font-semibold uppercase tracking-widest text-muted">Ruang Anda</p>}
      <nav id="desktop-navigation" aria-label="Navigasi desktop" className="space-y-2">{items.map(item => <NavigationItem key={item.href} item={item} compact={collapsed} />)}</nav>
    </div>
    {!collapsed && <p className="mb-5 px-3 text-sm leading-6 text-muted">Belajar, terhubung,<br />bertumbuh bersama.</p>}
    <Button variant="secondary" className="px-3" onClick={onToggle} aria-controls="desktop-navigation" aria-expanded={!collapsed}
      aria-label={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}>
      <Icon name={collapsed ? 'expand' : 'collapse'} />{!collapsed && <span>Ciutkan navigasi</span>}
    </Button>
  </aside>;
}
