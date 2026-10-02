import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { databaseError, type Mutation, type Structure, type StructureError } from '@/domain/organization';

const tables = { program: 'programs', level: 'institution_levels', relation: 'program_levels', group: 'groups' } as const;
export class OrganizationFailure extends Error {
  constructor(readonly reason: StructureError) { super('Organization operation failed.'); }
}
async function rows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 250) {
    const next = await page(offset, offset + 249);
    if (next.error || !next.data) throw new OrganizationFailure('unavailable');
    result.push(...next.data);
    if (next.data.length < 250) return result;
  }
}
export async function readStructure(client: SupabaseClient, tenant: string): Promise<Structure> {
  // Stable paged reads avoid silently truncating at PostgREST's default response cap.
  const results = await Promise.all([
    rows((from, to) => client.from('programs').select('id,name,description,program_type_id,is_active,updated_at').eq('institution_id', tenant).is('deleted_at', null).order('name').order('id').range(from, to)),
    rows((from, to) => client.from('institution_levels').select('id,name,code,sort_order,is_active').eq('institution_id', tenant).order('sort_order').order('name').order('id').range(from, to)),
    rows((from, to) => client.from('program_levels').select('id,program_id,level_id,is_active').eq('institution_id', tenant).order('id').range(from, to)),
    rows((from, to) => client.from('groups').select('id,name,program_id,program_level_id,is_active,status,updated_at').eq('institution_id', tenant).is('deleted_at', null).order('name').order('id').range(from, to)),
    rows((from, to) => client.from('program_types').select('id,name').eq('is_active', true).order('name').order('id').range(from, to)),
  ]);
  // Fail closed on a partial read; never combine a previous tenant's data with a partial result.
  return { programs: results[0], levels: results[1], relations: results[2], groups: results[3], learningTypes: results[4] } as Structure;
}
export async function mutateStructure(client: SupabaseClient, tenant: string, mutation: Mutation) {
  const table = tables[mutation.entity];
  const values = { ...mutation.values };
  if (typeof values.name === 'string') values.name = values.name.trim();
  // Leave an unchanged historical level out of UPDATE OF triggers, including after a relation is disabled.
  if (mutation.entity === 'group' && mutation.id && values.program_level_id === mutation.expected?.program_level_id) delete values.program_level_id;
  if (mutation.entity === 'group' && !mutation.id) { values.status = 'ACTIVE'; values.is_active = true; }
  // No upsert: duplicate relation/code must be explicit; an existing record is never overwritten by create.
  let query;
  if (mutation.id) {
    let update = client.from(table).update(values).eq('institution_id', tenant).eq('id', mutation.id);
    if (mutation.entity === 'program' || mutation.entity === 'group') update = update.is('deleted_at', null);
    for (const [key, expected] of Object.entries(mutation.expected!)) update = expected === null ? update.is(key, null) : update.eq(key, expected);
    query = update.select('id');
  } else query = client.from(table).insert({ ...values, institution_id: tenant }).select('id');
  const result = await query;
  if (result.error) throw new OrganizationFailure(databaseError(result.error.code));
  if (result.data?.length !== 1) throw new OrganizationFailure('conflict');
}
