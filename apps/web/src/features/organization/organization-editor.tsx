'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
import { parseMutation, structureErrors, type Entity, type Group, type Level, type Mutation, type Program, type ProgramLevel, type Structure } from '@/domain/organization';

export type Editor = { entity: Entity; row?: Program | Level | Group | ProgramLevel; toggle?: boolean; programId?: string };
const labels = { program: 'program', level: 'tingkatan', group: 'kelas / halaqah', relation: 'hubungan tingkatan' };
export function updateMutation(editor: Editor, values: Mutation['values']): Mutation {
  const { row, entity } = editor;
  if (!row) return { entity, values };
  const expected: NonNullable<Mutation['expected']> = entity === 'level' ? { name: (row as Level).name, code: (row as Level).code, sort_order: (row as Level).sort_order, is_active: row.is_active } :
    entity === 'relation' ? { is_active: row.is_active } : entity === 'group' ? { updated_at: (row as Group).updated_at, program_level_id: (row as Group).program_level_id } : { updated_at: (row as Program).updated_at };
  return { entity, id: row.id, values, expected };
}
export function OrganizationEditor({ editor, data, busy, error, onClose, onSave }: {
  editor: Editor; data: Structure; busy: boolean; error: string; onClose: () => void; onSave: (mutation: Mutation) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { entity, row, toggle } = editor;
  const [program, setProgram] = useState(editor.programId ?? (entity === 'group' ? (row as Group | undefined)?.program_id ?? '' : ''));
  const [validation, setValidation] = useState('');
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); };
  }, []);
  function dismiss() {
    if (busy) return;
    // Remove modal inertness before the parent restores focus to its launcher.
    dialog.current?.close(); onClose();
  }
  const title = toggle ? (row?.is_active ? 'Nonaktifkan ' : 'Aktifkan ') + labels[entity] : (row ? 'Edit ' : 'Tambah ') + labels[entity];
  function submit(form: FormData) {
    const value = (key: string) => String(form.get(key) ?? '').trim();
    let values: Mutation['values'];
    if (toggle && row) {
      values = entity === 'program' ? { name: (row as Program).name, description: (row as Program).description, is_active: !row.is_active } :
        entity === 'level' ? { name: (row as Level).name, code: (row as Level).code, sort_order: (row as Level).sort_order, is_active: !row.is_active } :
        entity === 'group' ? { name: (row as Group).name, program_level_id: (row as Group).program_level_id, is_active: !row.is_active, status: row.is_active ? 'INACTIVE' : 'ACTIVE' } : { is_active: !row.is_active };
    } else if (entity === 'program') values = { name: value('name'), description: value('description') || null, ...(row ? { is_active: row.is_active } : { program_type_id: value('program_type_id') }) };
    else if (entity === 'level') values = { name: value('name'), code: value('code'), sort_order: Number(value('sort_order')), is_active: row?.is_active ?? true };
    else if (entity === 'group') values = { name: value('name'), program_level_id: value('program_level_id') || null,
      ...(row ? { is_active: row.is_active, status: (row as Group).status } : { program_id: program }) };
    else values = { program_id: program, level_id: value('level_id') };
    const mutation = parseMutation(updateMutation(editor, values));
    if (!mutation) { setValidation(structureErrors.invalid); return; }
    setValidation(''); onSave(mutation);
  }
  const selectClass = 'min-h-12 w-full rounded-control border border-line bg-surface px-3 py-3 text-ink';
  const field = (label: string, name: string, children: React.ReactNode) => <div className="space-y-2"><label htmlFor={name} className="block text-sm font-semibold">{label}</label>{children}</div>;
  return <Dialog ref={dialog} title={title} onDismiss={dismiss}>
    <form className="mt-6 space-y-5" onSubmit={event => { event.preventDefault(); submit(new FormData(event.currentTarget)); }}>
      <fieldset disabled={busy} className="space-y-5">
        {toggle ? <p className="leading-7 text-muted">{row?.is_active ? 'Data tetap tersimpan. Pilihan ini berhenti tersedia untuk konteks baru; histori dan hubungan existing tetap dipertahankan.' : 'Data akan tersedia kembali sesuai aturan program dan tingkatan.'}</p> : <>
          {entity !== 'relation' && <Field id="name" name="name" label={'Nama ' + labels[entity]} defaultValue={(row as Program | undefined)?.name ?? ''} required maxLength={160} />}
          {entity === 'program' && <>
            <Field id="description" name="description" label="Deskripsi (opsional)" defaultValue={(row as Program | undefined)?.description ?? ''} maxLength={1000} />
            {!row && field('Jenis pembelajaran utama', 'program_type_id', <select id="program_type_id" name="program_type_id" className={selectClass} required defaultValue=""><option value="" disabled>Pilih jenis pembelajaran</option>{data.learningTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>)}
            <p className="text-sm text-muted">Program adalah pengelompokan organisasi. Jenis pembelajaran merupakan kategori belajar yang terpisah.</p>
          </>}
          {entity === 'level' && <><Field id="code" name="code" label="Kode tingkatan" required pattern="[A-Za-z0-9][A-Za-z0-9_\-]*" maxLength={32} defaultValue={(row as Level | undefined)?.code ?? ''} />
            <p className="text-sm text-muted">Gunakan huruf, angka, tanda hubung, atau garis bawah. Kode unik dalam lembaga.</p>
            <Field id="sort_order" name="sort_order" label="Urutan" type="number" min={0} max={9999} required defaultValue={(row as Level | undefined)?.sort_order ?? 0} /></>}
          {(entity === 'group' || entity === 'relation') && <>
            {field('Program', 'program_id', <select id="program_id" name="program_id" className={selectClass} required value={program} disabled={!!row || !!editor.programId} onChange={e => setProgram(e.target.value)}>
              <option value="" disabled>Pilih program</option>{data.programs.filter(p => p.is_active || p.id === program).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>)}
            {entity === 'relation' ? field('Tingkatan', 'level_id', <select id="level_id" name="level_id" className={selectClass} required defaultValue="">
              <option value="" disabled>Pilih tingkatan</option>{data.levels.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </select>) : field('Tingkatan', 'program_level_id', <select key={program} id="program_level_id" name="program_level_id" className={selectClass} defaultValue={(row as Group | undefined)?.program_level_id ?? ''}>
              <option value="">Tingkatan belum ditentukan</option>{data.relations.filter(r => r.program_id === program && (r.is_active && data.levels.some(l => l.id === r.level_id && l.is_active) || r.id === (row as Group | undefined)?.program_level_id)).map(r => <option key={r.id} value={r.id}>{data.levels.find(l => l.id === r.level_id)?.name ?? 'Tingkatan tidak tersedia'}{!r.is_active ? ' (nonaktif)' : ''}</option>)}
            </select>)}
            {entity === 'group' && row && <p className="text-sm text-muted">Program kelas tetap. Jika kelas sudah memiliki histori penempatan, perubahan tingkatan memerlukan kelas baru.</p>}
          </>}
        </>}
        {(validation || error) && <p role="alert" className="text-sm text-danger">{validation || error}</p>}
        <div className="flex flex-wrap gap-3"><Button type="submit">{busy ? 'Menyimpan…' : toggle ? 'Konfirmasi' : 'Simpan'}</Button><Button type="button" variant="secondary" onClick={dismiss}>Batal</Button></div>
      </fieldset>
    </form>
  </Dialog>;
}
