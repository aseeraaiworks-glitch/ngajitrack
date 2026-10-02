import 'server-only';
import { bootstrapContext } from './bootstrap-context';
import { resolveContext } from '@/domain/application-context';
import { canManageStructure, validId } from '@/domain/organization';

export async function organizationContext(ids: { institutionId: string; membershipId: string }) {
  const result = await bootstrapContext();
  const context = validId(ids.institutionId) && validId(ids.membershipId) ? resolveContext(result.contexts, ids) : null;
  return { result, context: canManageStructure(context) ? context : null };
}
