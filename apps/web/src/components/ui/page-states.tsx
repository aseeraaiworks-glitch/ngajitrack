import type { ReactNode } from 'react';
import { StateCard } from './state-card';

type StateProps = { title: string; children: ReactNode };
export function EmptyState({ title, children }: StateProps) { return <StateCard title={title}>{children}</StateCard>; }
export function ErrorState({ title, children }: StateProps) { return <StateCard title={title} alert>{children}</StateCard>; }
export function PermissionDeniedState({ title = 'Konteks tidak tersedia', children }: { title?: string; children: ReactNode }) {
  return <StateCard title={title} alert>{children}</StateCard>;
}
