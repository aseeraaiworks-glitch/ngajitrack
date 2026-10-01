import type { ComponentProps } from 'react';

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input className={`motion-control min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-base text-ink transition-colors placeholder:text-muted disabled:opacity-60 ${className}`} {...props} />;
}
