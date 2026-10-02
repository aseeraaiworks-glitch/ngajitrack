'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { contextPath, type ApplicationContext } from '@/domain/application-context';
import { structureErrors, type Entity, type Mutation, type Structure } from '@/domain/organization';
import { loadOrganization, saveOrganization, StructureRequestError } from '@/data/organization-api';
import { LatestRequest } from '@/application/latest-request';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { LoadingState } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, PermissionDeniedState } from '@/components/ui/page-states';
import { useToast } from '@/components/ui/toast';
import { OrganizationEditor, type Editor } from './organization-editor';

export function OrganizationManager({ context }: { context: ApplicationContext }) {
  const url = contextPath(context) + '/structure/data';
  const [data, setData] = useState<Structure | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading');
  const [tab, setTab] = useState<Entity>('program');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(new LatestRequest());
  const launcher = useRef<HTMLElement | null>(null);
  const toast = useToast();
  const load = useCallback(async () => {
    const request = pending.current.begin();
    try {
      const result = await loadOrganization(url, request.signal);
      if (request.current()) { setData(result); setPhase('ready'); }
    } catch (error) {
      if (request.current()) setPhase(error instanceof StructureRequestError && error.code === 'denied' ? 'denied' : 'error');
    }
  }, [url]);
  const reload = useCallback(async () => {
    setData(null); setEditor(null); setPhase('loading'); setBusy(false);
    await load();
  }, [load]);
  useEffect(() => {
    void load(); const requests = pending.current;
    const visible = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('focus', visible);
    return () => { requests.cancel(); window.removeEventListener('focus', visible); };
  }, [load, reload]);
  function open(value: Editor) { launcher.current = document.activeElement as HTMLElement; setError(''); setEditor(value); }
  function close() { setEditor(null); launcher.current?.focus(); }
  async function save(mutation: Mutation) {
    const request = pending.current.begin(); setBusy(true); setError('');
    try {
      await saveOrganization(url, mutation, request.signal);
      if (!request.current()) return;
      close(); toast('Perubahan tersimpan.', 'success'); await reload();
    } catch (error) {
      if (!request.current()) return;
      setBusy(false);
      if (!(error instanceof StructureRequestError) || ['denied', 'conflict', 'unavailable'].includes(error.code)) {
        close(); setData(null);
        setPhase(error instanceof StructureRequestError && error.code === 'denied' ? 'denied' : 'error');
        toast(error instanceof StructureRequestError && error.code !== 'unavailable' ? error.message : 'Hasil penyimpanan belum dapat dipastikan. Muat ulang daftar sebelum mencoba perubahan lagi.', 'error');
      } else setError(error instanceof StructureRequestError ? error.message : structureErrors.unavailable);
    }
  }
  const match = (name: string) => name.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'));
  const label = tab === 'program' ? 'program' : tab === 'level' ? 'tingkatan' : 'kelas / halaqah';
  const rows = !data ? [] : tab === 'program' ? data.programs : tab === 'level' ? data.levels : data.groups;
  const visible = rows.filter(r => match(r.name));
  return <section className="space-y-7" data-testid="organization-manager">
    <PageHeader eyebrow="Administrasi" title="Struktur lembaga"><p>Atur program, tingkatan, dan kelas di {context.institutionName}.</p></PageHeader>
    {phase === 'loading' && <LoadingState label="Memuat struktur lembaga…" />}
    {phase === 'denied' && <PermissionDeniedState><p>{structureErrors.denied}</p><a className="mt-4 inline-block underline" href="/app/select-context">Pilih konteks lain</a></PermissionDeniedState>}
    {phase === 'error' && <ErrorState title="Struktur belum tersedia"><p>{structureErrors.unavailable}</p><Button className="mt-4" onClick={reload}>Muat ulang</Button></ErrorState>}
    {phase === 'ready' && data && <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Bagian struktur">{(['program', 'level', 'group'] as const).map(t => <Button key={t} variant={tab === t ? 'primary' : 'secondary'} aria-pressed={tab === t} onClick={() => { setTab(t); setSearch(''); }}>
        {t === 'program' ? 'Program' : t === 'level' ? 'Tingkatan' : 'Kelas / Halaqah'}</Button>)}</div>
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 basis-full space-y-2 sm:flex-1 sm:basis-0"><label htmlFor="structure-search" className="text-sm font-semibold">Cari {label}</label><Input id="structure-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari berdasarkan nama" /></div>
        <Button onClick={() => open({ entity: tab })}>Tambah {label}</Button><Button variant="secondary" onClick={reload}>Muat ulang</Button></div>
      {!visible.length ? <EmptyState title={search ? 'Tidak ada hasil' : 'Belum ada ' + label}><p>{search ? 'Coba kata pencarian lain.' : 'Mulai dengan menambahkan ' + label + ' pertama.'}</p></EmptyState> :
        <ul aria-label={'Daftar ' + label} className="grid gap-4">{visible.map(row => {
          const group = data.groups.find(g => g.id === row.id);
          const level = data.levels.find(l => l.id === row.id);
          const program = data.programs.find(p => p.id === row.id);
          const relation = group && data.relations.find(r => r.id === group.program_level_id);
          return <li key={row.id}><Surface className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{row.name}</h2>
              {program?.description && <p className="mt-2 break-words text-sm text-muted">{program.description}</p>}
              {level && <p className="mt-2 text-sm text-muted">{level.code} · Urutan {level.sort_order}</p>}
              {group && <p className="mt-2 text-sm text-muted">{data.programs.find(p => p.id === group.program_id)?.name ?? 'Program tidak tersedia'} · {relation ? data.levels.find(l => l.id === relation.level_id)?.name : 'Tingkatan belum ditentukan'}</p>}
            </div><Badge tone={row.is_active ? 'success' : 'neutral'}>{group?.status === 'DRAFT' ? 'Draf' : group?.status === 'ARCHIVED' ? 'Diarsipkan' : row.is_active ? 'Aktif' : 'Nonaktif'}</Badge></div>
            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => open({ entity: tab, row })}>Edit</Button><Button variant="secondary" onClick={() => open({ entity: tab, row, toggle: true })}>{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
              {program && <Button variant="secondary" disabled={!program.is_active} onClick={() => open({ entity: 'relation', programId: program.id })}>Hubungkan tingkatan</Button>}</div>
            {program && <div className="border-t border-line pt-4"><h3 className="mb-2 text-sm font-semibold">Tingkatan program</h3>
              {!data.relations.some(r => r.program_id === program.id) && <p className="text-sm text-muted">Belum ada tingkatan terhubung.</p>}
              <ul className="space-y-2">{data.relations.filter(r => r.program_id === program.id).map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{data.levels.find(l => l.id === r.level_id)?.name ?? 'Tingkatan tidak tersedia'} · {r.is_active ? 'Terhubung' : 'Nonaktif'}</span><Button variant="secondary" aria-label={(r.is_active ? 'Nonaktifkan hubungan ' : 'Aktifkan hubungan ') + data.levels.find(l => l.id === r.level_id)?.name} onClick={() => open({ entity: 'relation', row: r, toggle: true })}>{r.is_active ? 'Nonaktifkan hubungan' : 'Aktifkan hubungan'}</Button></li>)}</ul>
            </div>}
          </Surface></li>;
        })}</ul>}
    </>}
    {editor && data && <OrganizationEditor key={editor.entity + (editor.row?.id ?? 'new') + !!editor.toggle} editor={editor} data={data} busy={busy} error={error} onClose={close} onSave={save} />}
  </section>;
}
