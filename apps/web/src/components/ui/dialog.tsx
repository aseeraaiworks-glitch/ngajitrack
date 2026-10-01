'use client';
import { useId, type ComponentProps } from 'react';
import { Button } from './button';

export function Dialog({ title, onDismiss, variant = 'center', children, ...props }: Omit<ComponentProps<'dialog'>, 'title'> & {
  title: string; onDismiss: () => void; variant?: 'center' | 'drawer';
}) {
  const titleId = useId();
  return <dialog {...props} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onDismiss(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]')]
        .filter(node => !node.matches(':disabled') && node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    className={'fixed overflow-auto border-0 bg-surface p-6 text-ink shadow-overlay backdrop:bg-overlay ' + (variant === 'drawer'
      ? 'inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(22rem,calc(100%-2rem))] max-w-none rounded-r-card open:animate-drawer'
      : 'inset-0 m-auto max-h-[85dvh] w-[min(36rem,calc(100%-2rem))] rounded-card open:animate-enter')}>
    <div className="flex items-center justify-between gap-4">
      <h2 id={titleId} className="text-xl font-semibold">{title}</h2>
      <Button variant="secondary" onClick={onDismiss} autoFocus>Tutup</Button>
    </div>
    {children}
  </dialog>;
}
