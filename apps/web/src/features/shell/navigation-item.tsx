import { Icon } from '@/components/ui/icon';
import type { NavigationEntry } from '@/domain/navigation';

export function NavigationItem({ item, compact = false }: { item: NavigationEntry; compact?: boolean }) {
  // Full document navigation keeps context isolation and bfcache revalidation.
  return <a href={item.href} aria-current={item.current ? 'page' : undefined} title={compact ? item.label : undefined}
    className={`motion-control flex min-h-12 items-center gap-3 rounded-control px-3 py-3 text-sm font-semibold transition-colors ${compact ? 'justify-center' : ''} ${item.current ? 'bg-soft text-brand' : 'text-muted hover:bg-soft hover:text-ink'}`}>
    <Icon name={item.icon} /><span className={compact ? 'sr-only' : ''}>{item.label}</span>
  </a>;
}
