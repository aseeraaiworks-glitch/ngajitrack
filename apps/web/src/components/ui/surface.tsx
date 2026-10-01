import type { ComponentProps } from 'react';

export function Surface({ className = '', ...props }: ComponentProps<'section'>) {
  return <section className={`rounded-card bg-surface p-6 shadow-card sm:p-8 ${className}`} {...props} />;
}
