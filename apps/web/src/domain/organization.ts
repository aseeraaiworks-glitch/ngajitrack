import type { ApplicationContext } from './application-context.ts';

export type Program = { id: string; name: string; description: string | null; program_type_id: string; is_active: boolean; updated_at: string };
export type Level = { id: string; name: string; code: string; sort_order: number; is_active: boolean };
export type ProgramLevel = { id: string; program_id: string; level_id: string; is_active: boolean };
export type Group = { id: string; name: string; program_id: string; program_level_id: string | null; is_active: boolean; status: string; updated_at: string };
export type Structure = { programs: Program[]; levels: Level[]; relations: ProgramLevel[]; groups: Group[]; learningTypes: { id: string; name: string }[] };
export type Entity = 'program' | 'level' | 'relation' | 'group';
export type Mutation = { entity: Entity; id?: string; values: Record<string, string | number | boolean | null>; expected?: Record<string, string | number | boolean | null> };
export type StructureError = 'invalid' | 'denied' | 'duplicate' | 'conflict' | 'relationship' | 'rule' | 'unavailable';
export const structureErrors: Record<StructureError, string> = {
  invalid: 'Periksa isian. Nama wajib diisi dan pilihan harus sesuai.',
  denied: 'Akses administrasi tidak tersedia. Periksa kembali konteks Anda.',
  duplicate: 'Kode atau hubungan tersebut sudah digunakan. Muat ulang dan gunakan data yang tersedia.',
  conflict: 'Data sudah berubah atau tidak tersedia. Muat ulang sebelum mengedit kembali.',
  relationship: 'Hubungan yang dipilih tidak tersedia atau masih digunakan.',
  rule: 'Perubahan tidak sesuai aturan. Periksa status program dan tingkatan. Untuk konteks kelas yang sudah memiliki histori, buat kelas baru.',
  unavailable: 'Struktur belum dapat dimuat atau disimpan. Coba lagi setelah koneksi tersedia.',
};
export function canManageStructure(context: ApplicationContext | null) {
  return context?.roleCode === 'INSTITUTION_ADMIN' && context.presentation.queryIntent === 'institution-operations';
}
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function fields(value: unknown, required: string[]) { return record(value) && Object.keys(value).length === required.length && required.every(k => Object.hasOwn(value, k)); }
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const stamp = (v: unknown) => typeof v === 'string' && v.length < 40 && Number.isFinite(Date.parse(v));
// Parse an exact, operation-specific allowlist. Never pass a SELECT row or client object through to PostgREST.
export function parseMutation(input: unknown): Mutation | null {
  if (!record(input) || !['program', 'level', 'relation', 'group'].includes(String(input.entity))) return null;
  const edit = input.id !== undefined;
  if (!fields(input, edit ? ['entity', 'id', 'values', 'expected'] : ['entity', 'values']) || (edit && !validId(input.id))) return null;
  const { entity, values: v, expected: e } = input;
  if (!record(v)) return null;
  if (entity === 'program') {
    if (!fields(v, edit ? ['name', 'description', 'is_active'] : ['name', 'description', 'program_type_id']) || !text(v.name, 160) ||
      !(v.description === null || (typeof v.description === 'string' && v.description.length <= 1000 && !/[\u0000-\u0008]/.test(v.description)))) return null;
    if (edit ? typeof v.is_active !== 'boolean' || !fields(e, ['updated_at']) || !stamp((e as Record<string, unknown>).updated_at) : !validId(v.program_type_id)) return null;
  } else if (entity === 'level') {
    if (!fields(v, ['name', 'code', 'sort_order', 'is_active']) || !text(v.name, 160) || typeof v.code !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(v.code) ||
      !Number.isSafeInteger(v.sort_order) || Number(v.sort_order) < 0 || Number(v.sort_order) > 9999 || typeof v.is_active !== 'boolean') return null;
    if (edit && (!fields(e, ['name', 'code', 'sort_order', 'is_active']) || !parseMutation({ entity: 'level', values: e }))) return null;
  } else if (entity === 'relation') {
    if (edit ? !fields(v, ['is_active']) || typeof v.is_active !== 'boolean' || !fields(e, ['is_active']) || typeof (e as Record<string, unknown>).is_active !== 'boolean'
      : !fields(v, ['program_id', 'level_id']) || !validId(v.program_id) || !validId(v.level_id)) return null;
  } else {
    if (!fields(v, edit ? ['name', 'program_level_id', 'is_active', 'status'] : ['name', 'program_id', 'program_level_id']) || !text(v.name, 160) || !(v.program_level_id === null || validId(v.program_level_id))) return null;
    if (edit ? typeof v.is_active !== 'boolean' || !['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(v.status)) || !fields(e, ['updated_at', 'program_level_id']) || !stamp((e as Record<string, unknown>).updated_at) || !((e as Record<string, unknown>).program_level_id === null || validId((e as Record<string, unknown>).program_level_id)) : !validId(v.program_id)) return null;
    if (edit && v.is_active !== (v.status === 'ACTIVE' || v.status === 'DRAFT')) return null;
  }
  return input as Mutation;
}
export function databaseError(code: string): StructureError {
  return ({ '42501': 'denied', '23505': 'duplicate', '23503': 'relationship', '23514': 'rule', '22023': 'invalid', '22P02': 'invalid' } as Record<string, StructureError>)[code] ?? 'unavailable';
}
