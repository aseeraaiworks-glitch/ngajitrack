'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { NavigationEntry } from '@/domain/navigation';
import { NavigationItem } from './navigation-item';

export function MobileNavigation({ items }: { items: NavigationEntry[] }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const resize = () => { if (desktop.matches) { dialog.current?.close(); setOpen(false); } };
    desktop.addEventListener('change', resize);
    return () => desktop.removeEventListener('change', resize);
  }, []);
  return <div className="lg:hidden">
    <Button ref={trigger} variant="secondary" className="min-w-12 px-3" aria-label="Buka navigasi" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      onClick={() => { setOpen(true); dialog.current?.showModal(); }}><Icon name="menu" /></Button>
    <Dialog ref={dialog} id={id} title="Navigasi" variant="drawer" onDismiss={close}>
      <p className="mb-6 mt-6 text-sm text-muted">Ruang Anda di NgajiTrack</p>
      <nav aria-label="Navigasi mobile" className="space-y-2">{items.map(item => <NavigationItem key={item.href} item={item} />)}</nav>
    </Dialog>
  </div>;
}
