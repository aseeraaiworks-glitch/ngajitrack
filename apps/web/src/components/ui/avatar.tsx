export function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => [...part][0]).join('').toLocaleUpperCase('id');
  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-sm font-semibold text-brand">{initials || 'N'}</span>;
}
