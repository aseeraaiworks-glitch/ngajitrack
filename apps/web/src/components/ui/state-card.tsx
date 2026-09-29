import type { ReactNode } from 'react';

export function StateCard({ title, children, alert = false }: { title: string; children: ReactNode; alert?: boolean }) {
  return <section role={alert ? 'alert' : undefined} className="rounded-card border border-line bg-surface p-7 shadow-card sm:p-10">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    <div className="mt-3 leading-7 text-muted">{children}</div>
  </section>;
}
