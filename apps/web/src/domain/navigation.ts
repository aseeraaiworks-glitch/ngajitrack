import { contextPath, type ApplicationContext } from './application-context.ts';
import { canManageStructure } from './organization.ts';

export type NavigationEntry = { href: string; label: string; icon: 'home' | 'context'; current: boolean };
const labels: Record<string, string> = {
  INSTITUTION_ADMIN: 'Ruang administrasi', MUDIR: 'Ruang kepemimpinan', WAKIL_MUDIR: 'Ruang kepemimpinan',
  GUARDIAN: 'Ruang wali', TEACHER: 'Ruang pengajaran', STUDENT: 'Ruang santri',
};
// Presentation only. Every link points to an implemented server-validated route.
// There are deliberately no links to future business pages or derived grants.
export function navigationFor(context: ApplicationContext | null, hasProfile = true, pathname?: string): NavigationEntry[] {
  if (!hasProfile) return [];
  const home = context && labels[context.roleCode] ? [{ href: contextPath(context), label: labels[context.roleCode], icon: 'home' as const, current: true }] : [];
  const structure = context && canManageStructure(context) ? [{ href: contextPath(context) + '/structure', label: 'Struktur lembaga', icon: 'context' as const, current: false }] : [];
  const items = [...home, ...structure, { href: '/app/select-context', label: 'Pilihan konteks', icon: 'context' as const, current: false }];
  return pathname ? items.map(item => ({ ...item, current: item.href.split('?')[0] === pathname })) : items;
}
