import type { ApplicationContext } from '@/domain/application-context';
import { StateCard } from '@/components/ui/state-card';

export function CurrentContextLabel({ context }: { context: ApplicationContext }) {
  return <StateCard title={context.roleLabel}>
    <p data-testid="active-institution" className="font-semibold text-ink">{context.institutionName}</p>
    <p className="mt-2" data-testid="active-scope">{context.scopeKind === 'INSTITUTION' ? 'Cakupan seluruh lembaga' :
      context.scopeKind === 'PROGRAMS' ? 'Cakupan program: ' + context.programLabels.join(', ') : 'Sesuai hubungan dan penugasan Anda'}</p>
    <p className="mt-6">Konteks Anda sudah siap. Fitur untuk peran ini akan tersedia pada tahap berikutnya.</p>
  </StateCard>;
}
