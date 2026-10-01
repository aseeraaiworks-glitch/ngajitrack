import { Surface } from './surface';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-soft ${className}`} />;
}
export function LoadingState({ label = 'Memuat konteks Anda…' }: { label?: string }) {
  return <div role="status" aria-busy="true" className="space-y-6 py-4">
    <p className="text-sm text-muted">{label}</p><Skeleton className="h-9 w-2/3 max-w-sm" />
    <Surface className="space-y-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-2/3" /></Surface>
  </div>;
}
