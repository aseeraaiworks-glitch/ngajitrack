import { contextPath, type ApplicationContext } from './application-context.ts';

export type NavigationEntry = { href: string; label: string; icon: 'home' | 'context'; current: boolean };
const labels: Record<string, string> = {
  INSTITUTION_ADMIN: 'Ruang administrasi', MUDIR: 'Ruang kepemimpinan', WAKIL_MUDIR: 'Ruang kepemimpinan',
  GUARDIAN: 'Ruang wali', TEACHER: 'Ruang pengajaran', STUDENT: 'Ruang santri',
};
// Presentation only. Every link points to an implemented server-validated route.
// There are deliberately no links to future business pages or derived grants.
export function navigationFor(context: ApplicationContext | null, hasProfile = true): NavigationEntry[] {
  if (!hasProfile) return [];
  const home = context && labels[context.roleCode] ? [{ href: contextPath(context), label: labels[context.roleCode], icon: 'home' as const, current: true }] : [];
  return [...home, { href: '/app/select-context', label: 'Pilihan konteks', icon: 'context', current: false }];
}
