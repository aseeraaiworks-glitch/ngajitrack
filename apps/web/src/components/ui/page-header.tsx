import type { ReactNode } from 'react';

export function PageHeader({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return <header className="max-w-3xl">
    {eyebrow && <p className="mb-3 text-caption font-semibold uppercase tracking-[.16em] text-brand">{eyebrow}</p>}
    <h1 className="text-page font-semibold tracking-tight text-ink">{title}</h1>
    {children && <div className="mt-3 leading-7 text-muted">{children}</div>}
  </header>;
}
