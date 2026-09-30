import 'server-only';
import { redirect } from 'next/navigation';
import { authenticatedAccount } from './authenticated-account';
import { serverClient } from '@/lib/supabase/server';
import { contextSources } from '@/data/context-repository';
import { buildContexts } from '@/domain/application-context';

export async function bootstrapContext() {
  const account = await authenticatedAccount();
  if (!account.profile) return { ...account, status: 'no-profile' as const, contexts: [], institutionCount: 0 };
  const client = await serverClient();
  let sources;
  try { sources = await contextSources(client, account.profile.id); }
  catch {
    const { data: { user }, error } = await client.auth.getUser();
    if (!user && (!error || (error.status && error.status < 500))) redirect('/login');
    return { ...account, status: 'error' as const, contexts: [], institutionCount: 0 };
  }
  // A session invalidated while bootstrap was loading must not produce a context.
  const { data: { user }, error } = await client.auth.getUser();
  if (!user && (!error || (error.status && error.status < 500))) redirect('/login');
  if (error || user?.id !== account.userId) return { ...account, status: 'error' as const, contexts: [], institutionCount: 0 };
  return { ...account, status: 'ready' as const,
    contexts: buildContexts(sources, account.profile.id, Date.now()), institutionCount: sources.institutions.length };
}
export type ContextBootstrap = Awaited<ReturnType<typeof bootstrapContext>>;
