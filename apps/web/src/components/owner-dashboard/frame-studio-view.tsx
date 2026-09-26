'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { HexColorPicker } from 'react-colorful';
import { useDropzone } from 'react-dropzone';
import { Button, Slider } from '@snapbox/ui';

import type { OwnerFrame, OwnerFramesData } from '@/lib/owner-dashboard/frame-contract';
import {
  deleteFrame,
  updateFrame,
  createFrame,
} from '@/app/(owner-dashboard)/owner-dashboard/frame-studio/actions';

type Draft = {
  id: string | null;
  name: string;
  file: File | null;
  preview: string | null;
  boothId: string;
  active: boolean;
  color: string;
  tolerance: number;
};
const freshDraft = (): Draft => ({
  id: null,
  name: '',
  file: null,
  preview: null,
  boothId: '',
  active: false,
  color: '',
  tolerance: 15,
});
const bytes = (size: number | null) =>
  size == null ? 'Ukuran tidak tersedia' : `${(size / 1024 / 1024).toFixed(2)} MB`;

export function FrameStudioView({ data }: { data: OwnerFramesData }) {
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const quota =
    data.quota.limit === null
      ? 'Tidak tersedia'
      : data.quota.limit === -1
        ? `${data.quota.used} / ∞`
        : `${data.quota.used} / ${data.quota.limit}`;
  const dropzone = useDropzone({
    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDropAccepted: (accepted) => {
      const file = accepted[0];
      if (file)
        setDraft((current) => ({
          ...current,
          file,
          name: current.name || file.name.replace(/\.[^.]+$/, ''),
          preview: URL.createObjectURL(file),
        }));
    },
    onDropRejected: (files) =>
      setMessage(
        files[0]?.errors[0]?.code === 'file-too-large'
          ? 'File melebihi 5 MB.'
          : 'Pilih satu file PNG/JPG yang valid.',
      ),
  });
  useEffect(
    () => () => {
      if (draft.preview?.startsWith('blob:')) URL.revokeObjectURL(draft.preview);
    },
    [draft.preview],
  );

  function edit(frame: OwnerFrame) {
    setDraft({
      id: frame.id,
      name: frame.name,
      file: null,
      preview: frame.previewUrl,
      boothId: frame.boothIds[0] ?? '',
      active: frame.isActive,
      color: frame.transparentColorHex ?? '',
      tolerance: frame.toleranceDelta,
    });
    setMessage('');
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = new FormData();
    form.set('name', draft.name);
    form.set('boothId', draft.boothId);
    form.set('isActive', String(draft.active));
    form.set('transparentColorHex', draft.color);
    form.set('toleranceDelta', String(draft.tolerance));
    if (draft.file) form.set('file', draft.file);
    startTransition(async () => {
      const result = draft.id
        ? (form.set('id', draft.id), await updateFrame(form))
        : draft.file
          ? await createFrame(form)
          : null;
      setMessage(result?.message ?? 'Pilih file frame terlebih dahulu.');
      if (result?.ok) {
        setDraft(freshDraft());
        window.location.reload();
      }
    });
  }

  function remove(frame: OwnerFrame) {
    if (
      !window.confirm(
        `Hapus frame “${frame.name}”? Frame harus nonaktif dan tidak ditugaskan ke booth.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteFrame(frame.id);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <main className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-border pb-5">
        <div>
          <p className="text-muted-foreground text-sm font-bold tracking-[0.2em] uppercase">
            Studio / Operasional
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Frame Studio</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Atur overlay, chroma key, dan booth untuk setiap frame.
          </p>
        </div>
        <div
          className="border-2 border-border bg-main px-4 py-3 font-bold shadow-[4px_4px_0_0_var(--color-border)]"
          aria-label="Penggunaan kuota frame"
        >
          FRAME {quota}
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

      <section
        className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]"
        aria-label="Editor frame"
      >
        <form
          onSubmit={submit}
          className="space-y-5 border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl font-extrabold">{draft.id ? 'Edit frame' : 'Frame baru'}</h2>
            {draft.id && (
              <Button type="button" variant="neutral" onClick={() => setDraft(freshDraft())}>
                Batal
              </Button>
            )}
          </div>
          <div
            {...dropzone.getRootProps()}
            className={`checkerboard grid min-h-64 cursor-pointer place-items-center border-2 border-dashed border-border p-5 text-center transition outline-none ${dropzone.isDragActive ? 'ring-4 ring-main' : ''}`}
          >
            <input {...dropzone.getInputProps()} aria-label="Pilih gambar frame PNG atau JPG" />
            {draft.preview ? (
              <Image
                src={draft.preview}
                alt="Pratinjau frame di atas papan transparansi"
                width={960}
                height={720}
                unoptimized
                className="max-h-[22rem] max-w-full object-contain"
              />
            ) : (
              <div>
                <p className="text-lg font-bold">Lepas frame di sini</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  atau klik untuk memilih · PNG/JPG · maks. 5 MB
                </p>
                <p className="mt-4 text-xs font-semibold">Minimum 800 × 600 px</p>
              </div>
            )}
          </div>
          <label className="block space-y-1.5 text-sm font-semibold">
            Nama frame
            <input
              required
              maxLength={150}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="h-11 w-full border-2 border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold">
              Booth
              <select
                value={draft.boothId}
                onChange={(event) => setDraft({ ...draft, boothId: event.target.value })}
                className="h-11 w-full border-2 border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <option value="">Belum ditugaskan</option>
                {data.booths.map((booth) => (
                  <option key={booth.id} value={booth.id}>
                    {booth.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 border-2 border-border px-3 font-semibold">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                className="size-5 accent-black"
              />
              Active on Booth
            </label>
          </div>
          <div className="grid gap-5 border-t-2 border-border pt-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <label className="font-bold" htmlFor="frame-tolerance">
                  Toleransi chroma
                </label>
                <output
                  htmlFor="frame-tolerance"
                  className="border-2 border-border px-2 py-1 font-mono font-bold"
                >
                  {draft.tolerance}
                </output>
              </div>
              <Slider
                id="frame-tolerance"
                min={5}
                max={40}
                step={1}
                value={[draft.tolerance]}
                onValueChange={(value) =>
                  setDraft({ ...draft, tolerance: Array.isArray(value) ? (value[0] ?? 15) : 15 })
                }
                aria-label="Toleransi warna RGB"
              />
              <div className="mt-2 flex justify-between font-mono text-xs">
                <span>5 · Presisi</span>
                <span>40 · Luas</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block font-bold" htmlFor="frame-color">
                Warna transparan
              </label>
              <HexColorPicker
                color={draft.color || '#00ff00'}
                onChange={(color) => setDraft({ ...draft, color })}
                aria-label="Pilih warna chroma key"
              />
              <input
                id="frame-color"
                value={draft.color}
                onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                placeholder="#00FF00"
                className="mt-2 h-10 w-full border-2 border-border px-2 font-mono uppercase"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-border pt-5">
            <Button
              type="submit"
              disabled={
                isPending ||
                data.quota.limit === null ||
                (!draft.id && data.quota.limit !== -1 && data.quota.used >= data.quota.limit)
              }
            >
              {isPending ? 'Menyimpan…' : draft.id ? 'Simpan perubahan' : 'Simpan frame'}
            </Button>
            {draft.file && (
              <span className="text-muted-foreground text-sm">
                {draft.file.name} · {bytes(draft.file.size)}
              </span>
            )}
          </div>
        </form>

        <aside className="space-y-4" aria-labelledby="library-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="library-heading" className="text-2xl font-extrabold">
              Library
            </h2>
            <span className="font-mono text-sm">{data.frames.length} frame</span>
          </div>
          {data.frames.length === 0 ? (
            <p className="text-muted-foreground border-2 border-dashed border-border p-7">
              Belum ada frame. Upload desain pertama Anda.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {data.frames.map((frame) => (
                <li
                  key={frame.id}
                  className="overflow-hidden border-2 border-border bg-background shadow-[3px_3px_0_0_var(--color-border)]"
                >
                  <div className="checkerboard grid h-44 place-items-center border-b-2 border-border p-3">
                    {frame.previewUrl ? (
                      <Image
                        src={frame.previewUrl}
                        alt={`Thumbnail ${frame.name}`}
                        width={480}
                        height={360}
                        unoptimized
                        className="max-h-full w-auto object-contain"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">Pratinjau tak tersedia</span>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold">{frame.name}</h3>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {frame.width} × {frame.height} · {bytes(frame.fileSizeBytes)}
                        </p>
                      </div>
                      <span className="border-2 border-border px-2 py-1 text-xs font-bold">
                        {frame.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>
                    <p className="text-sm">
                      {frame.boothNames.length ? frame.boothNames.join(', ') : 'Belum ditugaskan'}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="neutral"
                        className="flex-1"
                        onClick={() => edit(frame)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="neutral"
                        onClick={() => remove(frame)}
                        disabled={isPending || frame.isActive || frame.boothIds.length > 0}
                        aria-label={`Hapus ${frame.name}`}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </main>
  );
}
