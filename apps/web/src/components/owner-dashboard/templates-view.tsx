'use client';

import { useState, useTransition } from 'react';

import {
  createTemplate,
  deleteTemplate,
  setTemplateActive,
  updateTemplate,
} from '@/app/(owner-dashboard)/owner-dashboard/templates/actions';
import {
  TEMPLATE_LAYOUTS,
  type OwnerTemplate,
  type TemplateInput,
} from '@/lib/owner-dashboard/template-contract';

const emptyDraft = (): TemplateInput => ({
  name: '',
  layoutType: 'single',
  poseGrid: { rows: 1, cols: 1, padding: 12 },
  printDimensions: '4x6',
  aspectRatio: '4:6',
  background: '#FFFFFF',
  isActive: true,
});
const fieldClass =
  'mt-1 min-h-11 w-full border-2 border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const buttonClass =
  'min-h-11 border-2 border-border px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60';

export function TemplatesView({ templates }: { templates: OwnerTemplate[] }) {
  const [rows, setRows] = useState(templates);
  const [draft, setDraft] = useState<TemplateInput>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const preset = TEMPLATE_LAYOUTS.find((layout) => layout.value === draft.layoutType)!;

  function chooseLayout(layoutType: TemplateInput['layoutType']) {
    const layout = TEMPLATE_LAYOUTS.find((item) => item.value === layoutType)!;
    setDraft((current) => ({
      ...current,
      layoutType,
      poseGrid: { ...current.poseGrid, rows: layout.rows, cols: layout.cols },
      aspectRatio: layout.aspectRatio,
      printDimensions: layout.printDimensions,
    }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    startTransition(async () => {
      const result = editing
        ? await updateTemplate({ ...draft, id: editing })
        : await createTemplate(draft);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function edit(template: OwnerTemplate) {
    setDraft({
      name: template.name,
      layoutType: template.layoutType,
      poseGrid: template.poseGrid,
      printDimensions: template.printDimensions,
      aspectRatio: template.aspectRatio,
      background: template.background,
      isActive: template.isActive,
    });
    setEditing(template.id);
    setMessage('');
  }

  function toggle(template: OwnerTemplate) {
    startTransition(async () => {
      const result = await setTemplateActive(template.id, !template.isActive);
      setMessage(result.message);
      if (result.ok)
        setRows((current) =>
          current.map((row) =>
            row.id === template.id ? { ...row, isActive: !template.isActive } : row,
          ),
        );
    });
  }

  function remove(template: OwnerTemplate) {
    if (!window.confirm(`Hapus template “${template.name}”? Tindakan ini tidak dapat dibatalkan.`))
      return;
    startTransition(async () => {
      const result = await deleteTemplate(template.id);
      setMessage(result.message);
      if (result.ok) setRows((current) => current.filter((row) => row.id !== template.id));
    });
  }

  return (
    <main className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-border pb-5">
        <div>
          <p className="text-muted-foreground text-sm font-bold">Operasional / Studio</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Template foto</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Atur susunan pose dan ukuran cetak untuk sesi photobooth.
          </p>
        </div>
        <div className="border-2 border-border bg-main px-4 py-3 font-bold shadow-[4px_4px_0_0_var(--color-border)]">
          {rows.length} TEMPLATE
        </div>
      </header>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className="border-2 border-border bg-secondary-background p-3"
        >
          {message}
        </p>
      )}

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
        <form
          onSubmit={submit}
          className="space-y-5 border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-sm font-bold">LAYOUT BUILDER</p>
              <h2 className="mt-1 text-2xl font-extrabold">
                {editing ? 'Edit template' : 'Template baru'}
              </h2>
            </div>
            {editing && (
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setDraft(emptyDraft());
                  setEditing(null);
                  setMessage('');
                }}
              >
                Batal edit
              </button>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold">Pilih layout</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEMPLATE_LAYOUTS.map((layout) => (
                <button
                  key={layout.value}
                  type="button"
                  aria-pressed={draft.layoutType === layout.value}
                  onClick={() => chooseLayout(layout.value)}
                  className={`${buttonClass} min-h-16 text-left ${draft.layoutType === layout.value ? 'bg-main shadow-[3px_3px_0_0_var(--color-border)]' : 'bg-background'}`}
                >
                  <span className="block font-bold">{layout.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {layout.rows} baris · {layout.cols} kolom
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold">
            Nama template
            <input
              required
              maxLength={150}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={fieldClass}
              autoComplete="off"
            />
          </label>

          <div>
            <h3 className="mb-2 text-sm font-bold">Atur bidang foto</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['rows', 'Baris', 1, 8],
                  ['cols', 'Kolom', 1, 8],
                  ['padding', 'Jarak (%)', 0, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    required
                    value={draft.poseGrid[key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        poseGrid: { ...draft.poseGrid, [key]: Number(event.target.value) },
                      })
                    }
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Ukuran cetak
              <input
                required
                maxLength={40}
                value={draft.printDimensions}
                onChange={(event) => setDraft({ ...draft, printDimensions: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Rasio aspek
              <input
                required
                maxLength={20}
                value={draft.aspectRatio}
                onChange={(event) => setDraft({ ...draft, aspectRatio: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Warna latar
              <input
                required
                maxLength={20}
                value={draft.background}
                onChange={(event) => setDraft({ ...draft, background: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end border-2 border-border px-3 py-2 font-semibold">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                className="size-5 accent-foreground"
              />
              Aktifkan template
            </label>
          </div>

          <button
            disabled={pending}
            className={`${buttonClass} bg-foreground px-5 text-background`}
          >
            {pending ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Simpan template'}
          </button>
        </form>

        <section aria-labelledby="preview-title" className="space-y-4">
          <div className="flex items-end justify-between border-b-2 border-border pb-3">
            <div>
              <p className="text-muted-foreground text-sm font-bold">PRATINJAU LANGSUNG</p>
              <h2 id="preview-title" className="mt-1 text-2xl font-extrabold">
                {preset.label}
              </h2>
            </div>
            <span className="font-semibold">{draft.printDimensions} in</span>
          </div>
          <div className="grid min-h-72 place-items-center border-2 border-dashed border-border bg-secondary-background p-5">
            <div
              aria-label={`Pratinjau ${draft.name || preset.label}, ${draft.poseGrid.rows} baris dan ${draft.poseGrid.cols} kolom`}
              className="grid aspect-[2/3] w-full max-w-56 gap-2 border-2 border-border p-3 shadow-[4px_4px_0_0_var(--color-border)]"
              style={{
                backgroundColor: /^#[\da-fA-F]{6}$/.test(draft.background)
                  ? draft.background
                  : '#FFFFFF',
                gridTemplateRows: `repeat(${draft.poseGrid.rows}, minmax(0, 1fr))`,
                gridTemplateColumns: `repeat(${draft.poseGrid.cols}, minmax(0, 1fr))`,
                gap: `${Math.min(draft.poseGrid.padding, 32) / 4}px`,
              }}
            >
              {Array.from(
                { length: Math.min(draft.poseGrid.rows * draft.poseGrid.cols, 64) },
                (_, index) => (
                  <div
                    key={index}
                    className="text-muted-foreground grid min-h-0 place-items-center border border-border/70 bg-secondary-background text-xs font-bold"
                  >
                    POSE {index + 1}
                  </div>
                ),
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            {draft.aspectRatio} · {draft.poseGrid.rows * draft.poseGrid.cols} bidang foto
          </p>
        </section>
      </div>

      <section
        aria-labelledby="template-list-title"
        className="space-y-4 border-t-4 border-border pt-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm font-bold">LIBRARY</p>
            <h2 id="template-list-title" className="mt-1 text-2xl font-extrabold">
              Template tersimpan
            </h2>
          </div>
          <span>{rows.filter((row) => row.isActive).length} aktif</span>
        </div>
        {rows.length === 0 ? (
          <p className="border-2 border-dashed border-border p-6">
            Belum ada template. Pilih layout, atur bidang foto, lalu simpan template pertama.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((template) => {
              const layout = TEMPLATE_LAYOUTS.find((item) => item.value === template.layoutType);
              return (
                <article key={template.id} className="border-2 border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold break-words">{template.name}</h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {layout?.label ?? template.layoutType} · {template.printDimensions} in
                      </p>
                      <p className="mt-1 text-sm">
                        {template.poseGrid.rows} × {template.poseGrid.cols} bidang ·{' '}
                        {template.isActive ? 'Aktif' : 'Nonaktif'}
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="grid size-14 shrink-0 gap-0.5 border-2 border-border p-1"
                      style={{
                        gridTemplateRows: `repeat(${template.poseGrid.rows}, minmax(0, 1fr))`,
                        gridTemplateColumns: `repeat(${template.poseGrid.cols}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from(
                        { length: Math.min(template.poseGrid.rows * template.poseGrid.cols, 16) },
                        (_, index) => (
                          <span
                            key={index}
                            className="border border-border bg-secondary-background"
                          />
                        ),
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={pending}
                      className={buttonClass}
                      onClick={() => edit(template)}
                    >
                      Edit
                    </button>
                    <button
                      disabled={pending}
                      className={buttonClass}
                      onClick={() => toggle(template)}
                    >
                      {template.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      disabled={pending}
                      className={`${buttonClass} text-destructive`}
                      onClick={() => remove(template)}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
