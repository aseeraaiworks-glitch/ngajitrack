import { bootstrapContext } from '@/application/bootstrap-context';
import { findContext } from '@/domain/application-context';
import { AccountShell } from '@/features/shell/account-shell';
import { ActiveContext } from '@/features/context/active-context';
import { ContextState } from '@/features/context/context-states';
import { ValidatePreference } from '@/features/context/validate-preference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Konteks aktif' };
export default async function ContextPage({ params }: { params: Promise<{ institutionId: string; membershipId: string }> }) {
  const ids = await params;
  const result = await bootstrapContext();
  const context = findContext(result.contexts, ids.institutionId, ids.membershipId);
  return <AccountShell userId={result.userId} profile={result.profile}>
    {result.status === 'error' ? <ContextState kind="error" /> : context ?
      <ActiveContext context={context} userId={result.userId} /> : <>
        <ValidatePreference contexts={result.contexts} userId={result.userId} /><ContextState kind="denied" />
      </>}
  </AccountShell>;
}
