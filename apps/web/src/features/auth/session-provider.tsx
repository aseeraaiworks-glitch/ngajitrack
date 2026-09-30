'use client';
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { contextReducer, emptyContext, type ContextEvent, type ContextState } from '@/domain/session-context';
import { browserClient } from '@/lib/supabase/browser';
import { clearPreference } from '@/features/context/preference';

const SessionContext = createContext<{ state: ContextState; dispatch: React.Dispatch<ContextEvent> } | null>(null);

export function SessionProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(contextReducer, { ...emptyContext, userId });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const { data: { subscription } } = browserClient().auth.onAuthStateChange((event, session) => {
      // Never await another Auth operation inside this callback (SDK lock).
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session) || (session && session.user.id !== userId)) {
        clearPreference(userId);
        dispatch({ type: 'clear' });
        setVisible(false);
        window.location.replace('/login');
      } else if (event === 'INITIAL_SESSION' && session?.user.id === userId) {
        setVisible(true);
      }
    });
    // A restored bfcache document must revalidate; it must not resurrect a logged-out account.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', onPageShow);
    return () => { subscription.unsubscribe(); window.removeEventListener('pageshow', onPageShow); };
  }, [userId]);
  return <SessionContext.Provider value={{ state, dispatch }}>{visible && state.userId ? children : <p role="status" className="p-10">Memeriksa sesi…</p>}</SessionContext.Provider>;
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is required.');
  return context;
}
