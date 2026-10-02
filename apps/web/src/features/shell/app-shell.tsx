'use client';
import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthenticatedProfile } from '@/domain/auth';
import { contextKey, type ApplicationContext } from '@/domain/application-context';
import { navigationFor } from '@/domain/navigation';
import { useSessionContext } from '@/features/auth/session-provider';
import { ContextSwitcher } from '@/features/context/context-switcher';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { MobileNavigation } from './mobile-navigation';

type ShellProps = { profile: AuthenticatedProfile | null; context: ApplicationContext | null; children: ReactNode };
function ShellFrame({ profile, context, children, switcher }: ShellProps & { switcher?: ReactNode }) {
  const { state } = useSessionContext();
  const [collapsed, setCollapsed] = useState(false);
  // Never retain a tenant/role label or link after the switcher invalidates state.
  const active = context && state.contextKey === contextKey(context) ? context : null;
  const items = navigationFor(active, !!profile, usePathname());
  return <div className="shell-layout" data-testid="app-shell" data-collapsed={collapsed}>
    <Sidebar items={items} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
    <div className="shell-body">
      <TopBar profile={profile} context={active} navigation={<MobileNavigation items={items} />} switcher={switcher} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-10 lg:py-12">
        {children}
      </main>
    </div>
  </div>;
}
export function AppShell({ userId, profile, context, children }: ShellProps & { userId: string }) {
  return context ? <ContextSwitcher context={context} userId={userId}
    render={(switcher, content) => <ShellFrame profile={profile} context={context} switcher={switcher}>{content}</ShellFrame>}>
    {children}
  </ContextSwitcher> : <ShellFrame profile={profile} context={null}>{children}</ShellFrame>;
}
