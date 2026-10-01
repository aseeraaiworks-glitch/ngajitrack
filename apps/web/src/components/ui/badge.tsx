import type { ReactNode } from 'react';
export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
const tones = {
  neutral: 'bg-soft text-ink', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning',
  error: 'bg-danger-soft text-danger', info: 'bg-info-soft text-info',
};
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-caption font-semibold ${tones[tone]}`}>{children}</span>;
}
