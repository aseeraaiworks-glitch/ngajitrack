import { bootstrapContext } from '@/application/bootstrap-context';
import { resolveContext } from '@/domain/application-context';
import { AccountShell } from '@/features/shell/account-shell';
import { ActiveContext } from '@/features/context/active-context';
import { ContextState } from '@/features/context/context-states';
import { ValidatePreference } from '@/features/context/validate-preference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Konteks aktif' };
export default async function ContextPage({ params, searchParams }: {
  params: Promise<{ institutionId: string; membershipId: string }>;
  searchParams: Promise<{ program?: string | string[] }>;
}) {
  const ids = await params;
  const { program } = await searchParams;
  const result = await bootstrapContext();
  const context = Array.isArray(program) ? null : resolveContext(result.contexts, { ...ids, programId: program });
  return <AccountShell userId={result.userId} profile={result.profile} context={context}>
    {result.status === 'error' ? <ContextState kind="error" /> : context ?
      <ActiveContext context={context} userId={result.userId} /> : <>
        <ValidatePreference contexts={result.contexts} userId={result.userId} /><ContextState kind="denied" />
      </>}
  </AccountShell>;
}
