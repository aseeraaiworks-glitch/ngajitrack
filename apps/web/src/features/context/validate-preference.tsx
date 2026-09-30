'use client';
import { useEffect } from 'react';
import { selectionDecision, type ApplicationContext } from '@/domain/application-context';
import { clearPreference, readPreference } from './preference';

export function ValidatePreference({ contexts, userId }: { contexts: ApplicationContext[]; userId: string }) {
  useEffect(() => {
    if (selectionDecision(contexts, readPreference(userId)).invalidPreference) clearPreference(userId);
  }, [contexts, userId]);
  return null;
}
