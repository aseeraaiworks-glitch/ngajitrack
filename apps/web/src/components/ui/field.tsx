import type { InputHTMLAttributes } from 'react';

export function Field({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="space-y-2">
    <label className="block text-sm font-semibold" htmlFor={id}>{label}</label>
    <input id={id} className="min-h-12 w-full rounded-control border border-line bg-surface px-4 py-3 text-base placeholder:text-muted/70 disabled:opacity-60" {...props} />
  </div>;
}
