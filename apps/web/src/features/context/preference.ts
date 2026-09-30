'use client';
import type { ContextReference } from '@/domain/application-context';
const prefix = 'ngajitrack.context.v1:';
export function preferenceKey(userId: string) { return prefix + userId; }
export function readPreference(userId: string) {
  try { return localStorage.getItem(preferenceKey(userId)); } catch { return null; }
}
export function clearPreference(userId: string) {
  try { localStorage.removeItem(preferenceKey(userId)); } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event('ngajitrack-preference'));
}
export function savePreference(userId: string, context: ContextReference) {
  try { localStorage.setItem(preferenceKey(userId), JSON.stringify({ institutionId: context.institutionId, membershipId: context.membershipId })); }
  catch { /* Context remains usable without persistent preference. */ }
  window.dispatchEvent(new Event('ngajitrack-preference'));
}
export function subscribePreference(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('ngajitrack-preference', listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('ngajitrack-preference', listener); };
}
