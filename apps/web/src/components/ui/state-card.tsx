import type { ReactNode } from 'react';
import { Surface } from './surface';
import { PageHeader } from './page-header';

export function StateCard({ title, children, alert = false }: { title: string; children: ReactNode; alert?: boolean }) {
  return <Surface role={alert ? 'alert' : undefined} className="animate-enter">
    <PageHeader title={title} />
    <div className="mt-3 leading-7 text-muted">{children}</div>
  </Surface>;
}
