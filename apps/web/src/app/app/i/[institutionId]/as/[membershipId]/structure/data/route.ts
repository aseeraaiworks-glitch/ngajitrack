import { organizationContext } from '@/application/organization-context';
import { readStructure, mutateStructure, OrganizationFailure } from '@/data/organization-repository';
import { parseMutation, structureErrors, type StructureError } from '@/domain/organization';
import { serverClient } from '@/lib/supabase/server';
import { reportUnexpected } from '@/lib/observability/report';
import { sameOriginWrite } from '@/domain/request-origin';

export const dynamic = 'force-dynamic';
type Route = { params: Promise<{ institutionId: string; membershipId: string }> };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' } });
const failure = (code: StructureError) => json({ error: { code, message: structureErrors[code] } },
  code === 'denied' ? 403 : code === 'unavailable' ? 503 : ['conflict', 'duplicate', 'relationship'].includes(code) ? 409 : 400);
function handleFailure(error: unknown) {
  const code = error instanceof OrganizationFailure ? error.reason : 'unavailable';
  if (code === 'unavailable') reportUnexpected(new Error('Organization service unavailable.'));
  return failure(code);
}
export async function GET(_request: Request, { params }: Route) {
  const ids = await params;
  const { result, context } = await organizationContext(ids);
  if (result.status === 'error') return failure('unavailable');
  if (!context) return failure('denied');
  let data;
  try { data = await readStructure(await serverClient(), context.institutionId); }
  catch (error) { return handleFailure(error); }
  const fresh = await organizationContext(ids);
  if (fresh.result.status === 'error') return failure('unavailable');
  if (!fresh.context) return failure('denied');
  return json(data);
}
export async function POST(request: Request, { params }: Route) {
  // Cookie-authenticated writes accept only this application's origin; no cross-site form submissions.
  if (!sameOriginWrite(request)) return failure('denied');
  if (!request.headers.get('content-type')?.startsWith('application/json')) return failure('invalid');
  const { result, context } = await organizationContext(await params);
  if (result.status === 'error') return failure('unavailable');
  if (!context) return failure('denied');
  let input;
  try { const body = await request.text(); if (body.length > 12000) return failure('invalid'); input = JSON.parse(body); } catch { return failure('invalid'); }
  const mutation = parseMutation(input);
  if (!mutation) return failure('invalid');
  try {
    await mutateStructure(await serverClient(), context.institutionId, mutation);
    return json({ ok: true });
  } catch (error) { return handleFailure(error); }
}
