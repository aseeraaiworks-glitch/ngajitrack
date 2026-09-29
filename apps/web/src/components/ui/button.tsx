import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const style = variant === 'primary' ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-line bg-surface text-ink hover:bg-soft';
  return <button className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${style} ${className}`} {...props} />;
}
