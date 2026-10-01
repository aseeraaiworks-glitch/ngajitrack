import type { ApplicationContext } from '@/domain/application-context';
import { Surface } from '@/components/ui/surface';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';

export function CurrentContextLabel({ context, compact = false }: { context: ApplicationContext; compact?: boolean }) {
  if (compact) return <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
    <p data-testid="shell-institution" className="min-w-0 break-words text-sm font-semibold">{context.institutionName}</p>
    <span data-testid="shell-role"><Badge>{context.roleLabel}</Badge></span>
  </div>;
  return <div className="animate-enter space-y-8" data-testid="context-content">
    <PageHeader title={context.roleLabel} eyebrow="Ruang Anda"><p>Selamat datang di ruang belajar yang terhubung.</p></PageHeader>
    <Surface className="max-w-3xl">
      <p className="mb-2 text-caption font-semibold uppercase tracking-widest text-muted">Konteks aktif</p>
      <p data-testid="active-institution" className="text-xl font-semibold text-ink">{context.institutionName}</p>
      <p className="mt-3 leading-7 text-muted" data-testid="active-scope">{context.scopeKind === 'INSTITUTION' ? 'Cakupan seluruh lembaga' :
      context.scopeKind === 'PROGRAMS' ? 'Cakupan program: ' + context.programLabels.join(', ') : 'Sesuai hubungan dan penugasan Anda'}</p>
      <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-muted">Konteks Anda sudah siap. Fitur untuk peran ini akan tersedia pada tahap berikutnya.</p>
    </Surface>
  </div>;
}
