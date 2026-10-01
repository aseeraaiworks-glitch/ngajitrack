import type { InputHTMLAttributes } from 'react';
import { Input } from './input';

export function Field({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <div className="space-y-2">
    <label className="block text-sm font-semibold" htmlFor={id}>{label}</label>
    <Input id={id} {...props} />
  </div>;
}
