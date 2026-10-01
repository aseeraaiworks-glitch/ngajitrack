export type IconName = 'home' | 'context' | 'menu' | 'collapse' | 'expand' | 'arrow';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  context: 'M4 5h16M16 1l4 4-4 4M20 19H4m4-4-4 4 4 4',
  menu: 'M4 6h16M4 12h16M4 18h16', collapse: 'm14 6-6 6 6 6', expand: 'm10 6 6 6-6 6', arrow: 'M5 12h14m-6-6 6 6-6 6',
};
export function Icon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
