import { organizationContext } from '@/application/organization-context';
import { AccountShell } from '@/features/shell/account-shell';
import { ActiveContext } from '@/features/context/active-context';
import { ContextState } from '@/features/context/context-states';
import { OrganizationManager } from '@/features/organization/organization-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Struktur lembaga' };
export default async function StructurePage({ params }: { params: Promise<{ institutionId: string; membershipId: string }> }) {
  const { result, context } = await organizationContext(await params);
  return <AccountShell userId={result.userId} profile={result.profile} context={context}>
    {result.status === 'error' ? <ContextState kind="error" /> : context ?
      <ActiveContext context={context} userId={result.userId}><OrganizationManager context={context} /></ActiveContext> : <ContextState kind="denied" />}
  </AccountShell>;
}
