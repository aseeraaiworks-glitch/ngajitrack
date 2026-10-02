import { structureErrors, type Mutation, type Structure, type StructureError } from '@/domain/organization';

export class StructureRequestError extends Error {
  constructor(readonly code: StructureError) { super(structureErrors[code]); }
}
async function request(url: string, signal: AbortSignal, mutation?: Mutation) {
  const response = await fetch(url, { method: mutation ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    headers: mutation ? { 'Content-Type': 'application/json' } : undefined, body: mutation ? JSON.stringify(mutation) : undefined });
  // Auth expiry redirects to login rather than returning JSON. Discard any previous dataset.
  if (response.redirected) throw new StructureRequestError('denied');
  const body = await response.json();
  if (!response.ok) throw new StructureRequestError(Object.hasOwn(structureErrors, body?.error?.code) ? body.error.code : 'unavailable');
  return body;
}
export async function loadOrganization(url: string, signal: AbortSignal): Promise<Structure> { return request(url, signal); }
export async function saveOrganization(url: string, mutation: Mutation, signal: AbortSignal) { await request(url, signal, mutation); }
