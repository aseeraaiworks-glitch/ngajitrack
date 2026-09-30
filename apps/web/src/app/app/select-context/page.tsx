import { bootstrapContext } from '@/application/bootstrap-context';
import { AccountShell } from '@/features/shell/account-shell';
import { ContextChooser } from '@/features/context/context-chooser';
import { ContextState } from '@/features/context/context-states';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pilih konteks' };
export default async function SelectContext() {
  const result = await bootstrapContext();
  return <AccountShell userId={result.userId} profile={result.profile}>
    {result.status === 'error' ? <ContextState kind="error" /> : result.contexts.length ?
      <ContextChooser contexts={result.contexts} userId={result.userId} /> : <ContextState kind="empty" />}
  </AccountShell>;
}
