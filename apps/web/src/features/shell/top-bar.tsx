import type { ReactNode } from 'react';
import type { AuthenticatedProfile } from '@/domain/auth';
import type { ApplicationContext } from '@/domain/application-context';
import { LogoutButton } from '@/features/auth/logout-button';
import { CurrentContextLabel } from '@/features/context/current-context-label';
import { ProfileMenu } from './profile-menu';
import { OnlineStatus } from './online-status';

export function TopBar({ context, profile, navigation, switcher }: {
  context: ApplicationContext | null; profile: AuthenticatedProfile | null; navigation: ReactNode; switcher?: ReactNode;
}) {
  return <header className="border-b border-line bg-surface px-4 py-4 sm:px-8">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex items-center gap-3">{navigation}<span className="hidden text-lg font-semibold tracking-tight sm:inline lg:text-base">NgajiTrack</span></div>
      <div className="flex min-w-0 items-center gap-3"><ProfileMenu profile={profile} /><LogoutButton /></div>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="min-w-0 flex-1">{context ? <CurrentContextLabel context={context} compact /> :
          <p className="text-sm text-muted" data-testid="shell-no-context">Belum ada konteks aktif</p>}</div>
        <div className="flex flex-wrap items-center gap-3"><OnlineStatus />{switcher}</div>
      </div>
    </div>
  </header>;
}
