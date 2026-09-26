'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import {
  publishKioskTheme,
  restoreKioskThemeVersion,
  saveKioskTheme,
} from '@/app/(owner-dashboard)/owner-dashboard/kiosk-theme/actions';
import {
  ATTRACT_MODE_TYPES,
  KIOSK_ATTRACT_LABELS,
  KIOSK_BASE_COLORS,
  KIOSK_FONTS,
  KIOSK_ORIENTATION_LABELS,
  KIOSK_PANEL_LABELS,
  ORIENTATIONS,
  PANEL_STYLES,
  checkKioskContrast,
  pickReadableText,
  type ContrastCheck,
  type KioskThemeDraft,
  type KioskThemesData,
} from '@/lib/owner-dashboard/kiosk-theme-contract';

const fieldClass =
  'min-h-11 w-full border-2 border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const buttonClass =
  'min-h-11 border-2 border-border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60';

const draftFrom = (data: KioskThemesData): KioskThemeDraft => {
  const { theme } = data;
  return {
    logoUrl: theme.logoUrl,
    primaryColor: /^#[\da-fA-F]{6}$/.test(theme.primaryColor)
      ? theme.primaryColor
      : KIOSK_BASE_COLORS.primaryColor,
    accentColor: /^#[\da-fA-F]{6}$/.test(theme.accentColor)
      ? theme.accentColor
      : KIOSK_BASE_COLORS.accentColor,
    backgroundColor: /^#[\da-fA-F]{6}$/.test(theme.backgroundColor)
      ? theme.backgroundColor
      : KIOSK_BASE_COLORS.backgroundColor,
    fontFamily: theme.fontFamily,
    welcomeText: theme.welcomeText,
    ctaText: theme.ctaText ?? 'SENTUH UNTUK MULAI',
    attractModeType: theme.attractModeType,
    attractVideoUrl: theme.attractVideoUrl,
    attractSlideshowEnabled: theme.attractSlideshowEnabled,
    panelStyle: theme.panelStyle,
    orientation: theme.orientation,
  };
};

const hex = (value: string) => (/^#[\da-fA-F]{6}$/.test(value) ? value : '#000000');
const fontStack = (family: string) =>
  KIOSK_FONTS.find((font) => font.value === family)?.stack ?? KIOSK_FONTS[0].stack;

export function KioskThemeView({ data }: { data: KioskThemesData }) {
  const [draft, setDraft] = useState<KioskThemeDraft>(() => draftFrom(data));
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const contrast = useMemo<{ ok: boolean; checks: ContrastCheck[] }>(
    () => checkKioskContrast(draft),
    [draft],
  );
  const onPrimary = useMemo(() => pickReadableText(draft.primaryColor), [draft.primaryColor]);
  const onAccent = useMemo(() => pickReadableText(draft.accentColor), [draft.accentColor]);
  const onSurface = useMemo(() => pickReadableText(draft.backgroundColor), [draft.backgroundColor]);

  function patch<Key extends keyof KioskThemeDraft>(key: Key, value: KioskThemeDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function run(
    action: () => Promise<{ ok: boolean; message: string; fieldErrors?: Record<string, string> }>,
  ) {
    setMessage('');
    setFieldErrors({});
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (!result.ok && result.fieldErrors) setFieldErrors(result.fieldErrors);
    });
  }

  const save = () => run(() => saveKioskTheme(draft));
  const publish = () => {
    if (!contrast.ok) {
      setFieldErrors({ form: 'Perbaiki kontras warna sebelum publikasi.' });
      setMessage('Kontras warna belum memenuhi 4,5:1.');
      return;
    }
    run(() => publishKioskTheme(draft));
  };

  function restore(versionId: string) {
    setMessage('');
    setFieldErrors({});
    startTransition(async () => {
      const result = await restoreKioskThemeVersion(versionId);
      setMessage(result.message);
      if (result.ok && result.draft) setDraft(result.draft);
    });
  }

  const isPortrait = draft.orientation === 'PORTRAIT';

  return (
    <main className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-border pb-5">
        <div>
          <p className="text-muted-foreground text-sm font-bold tracking-[0.2em] uppercase">
            Operasional / Kiosk
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Tema kiosk</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Atur identitas visual kiosk, teks sambutan, mode attract, dan gaya panel.
          </p>
        </div>
        <div className="border-2 border-border bg-main px-4 py-3 font-bold shadow-[4px_4px_0_0_var(--color-border)]">
          VERSI {data.theme.version} · {data.theme.isPublished ? 'PUBLISHED' : 'DRAFT'}
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
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.9fr)]"
        aria-label="Editor tema kiosk"
      >
        <div className="space-y-6">
          <div className="border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7">
            <h2 className="text-2xl font-extrabold">Warna</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Warna teks diturunkan otomatis agar kontras minimal 4,5:1 terhadap latar.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {(
                [
                  ['primaryColor', 'Warna primary'],
                  ['backgroundColor', 'Warna latar'],
                  ['accentColor', 'Warna accent'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`Pilih ${label}`}
                      value={hex(draft[key])}
                      onChange={(event) => patch(key, event.target.value.toUpperCase())}
                      className="h-11 w-14 shrink-0 cursor-pointer border-2 border-border bg-background"
                    />
                    <input
                      value={draft[key]}
                      onChange={(event) => patch(key, event.target.value.toUpperCase())}
                      maxLength={7}
                      className={`${fieldClass} font-mono uppercase`}
                    />
                  </span>
                  {fieldErrors[key] && (
                    <span className="text-destructive mt-1 block text-xs font-semibold">
                      {fieldErrors[key]}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <ul
              className="mt-5 space-y-2 border-t-2 border-border pt-4"
              aria-label="Hasil validasi kontras"
            >
              {contrast.checks.map((check) => (
                <li key={check.label} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{check.label}</span>
                  <span
                    className={`border-2 border-border px-2 py-1 font-mono text-xs font-bold ${check.passes ? '' : 'text-destructive'}`}
                  >
                    {check.ratio}:1 {check.passes ? 'LULUS' : 'GAGAL'}
                  </span>
                </li>
              ))}
            </ul>
            {fieldErrors.form && (
              <p className="text-destructive mt-3 text-sm font-semibold">{fieldErrors.form}</p>
            )}
          </div>

          <div className="border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7">
            <h2 className="text-2xl font-extrabold">Identitas &amp; teks</h2>
            <div className="mt-5 space-y-5">
              <label className="block text-sm font-semibold">
                URL logo (PNG/JPG maks. 500 KB)
                <input
                  value={draft.logoUrl ?? ''}
                  onChange={(event) => patch('logoUrl', event.target.value || null)}
                  placeholder="https://…"
                  className={fieldClass}
                  autoComplete="off"
                />
                {fieldErrors.logoUrl && (
                  <span className="text-destructive mt-1 block text-xs font-semibold">
                    {fieldErrors.logoUrl}
                  </span>
                )}
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Font</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {KIOSK_FONTS.map((font) => (
                    <button
                      key={font.value}
                      type="button"
                      aria-pressed={draft.fontFamily === font.value}
                      onClick={() => patch('fontFamily', font.value)}
                      style={{ fontFamily: font.stack }}
                      className={`${buttonClass} min-h-14 text-left ${draft.fontFamily === font.value ? 'bg-main shadow-[3px_3px_0_0_var(--color-border)]' : 'bg-background'}`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm font-semibold">
                Teks sambutan
                <textarea
                  value={draft.welcomeText ?? ''}
                  onChange={(event) => patch('welcomeText', event.target.value || null)}
                  maxLength={300}
                  rows={3}
                  className={`${fieldClass} mt-1 py-2`}
                />
              </label>

              <label className="block text-sm font-semibold">
                Teks CTA
                <input
                  value={draft.ctaText}
                  onChange={(event) => patch('ctaText', event.target.value)}
                  maxLength={120}
                  className={fieldClass}
                />
                {fieldErrors.ctaText && (
                  <span className="text-destructive mt-1 block text-xs font-semibold">
                    {fieldErrors.ctaText}
                  </span>
                )}
              </label>
            </div>
          </div>

          <div className="border-4 border-border bg-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7">
            <h2 className="text-2xl font-extrabold">Attract, panel &amp; orientasi</h2>
            <div className="mt-5 space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Mode attract</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ATTRACT_MODE_TYPES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={draft.attractModeType === mode}
                      onClick={() => patch('attractModeType', mode)}
                      className={`${buttonClass} ${draft.attractModeType === mode ? 'bg-main shadow-[3px_3px_0_0_var(--color-border)]' : 'bg-background'}`}
                    >
                      {KIOSK_ATTRACT_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </fieldset>

              {(draft.attractModeType === 'VIDEO' || draft.attractModeType === 'IMAGE') && (
                <label className="block text-sm font-semibold">
                  {draft.attractModeType === 'VIDEO'
                    ? 'URL video attract (MP4/WebM maks. 50 MB)'
                    : 'URL gambar attract (PNG/JPG maks. 5 MB)'}
                  <input
                    value={draft.attractVideoUrl ?? ''}
                    onChange={(event) => patch('attractVideoUrl', event.target.value || null)}
                    placeholder="https://…"
                    className={fieldClass}
                    autoComplete="off"
                  />
                  {fieldErrors.attractVideoUrl && (
                    <span className="text-destructive mt-1 block text-xs font-semibold">
                      {fieldErrors.attractVideoUrl}
                    </span>
                  )}
                </label>
              )}

              <label className="flex min-h-11 items-center gap-3 border-2 border-border px-3 font-semibold">
                <input
                  type="checkbox"
                  checked={draft.attractSlideshowEnabled}
                  onChange={(event) => patch('attractSlideshowEnabled', event.target.checked)}
                  className="size-5 accent-foreground"
                />
                Aktifkan slideshow attract
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Gaya panel</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PANEL_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      aria-pressed={draft.panelStyle === style}
                      onClick={() => patch('panelStyle', style)}
                      className={`${buttonClass} ${draft.panelStyle === style ? 'bg-main shadow-[3px_3px_0_0_var(--color-border)]' : 'bg-background'}`}
                    >
                      {KIOSK_PANEL_LABELS[style]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-bold">Orientasi</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ORIENTATIONS.map((orientation) => (
                    <button
                      key={orientation}
                      type="button"
                      aria-pressed={draft.orientation === orientation}
                      onClick={() => patch('orientation', orientation)}
                      className={`${buttonClass} ${draft.orientation === orientation ? 'bg-main shadow-[3px_3px_0_0_var(--color-border)]' : 'bg-background'}`}
                    >
                      {KIOSK_ORIENTATION_LABELS[orientation]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          <div className="border-4 border-border bg-secondary-background p-5 shadow-[6px_6px_0_0_var(--color-border)] sm:p-7">
            <h2 className="text-2xl font-extrabold">PIN Lock</h2>
            <p className="mt-2 max-w-2xl text-sm">
              PIN Lock aktif selama sesi capture dan dikonfigurasi per booth, bukan per tema. Buka
              halaman Machines untuk mengaktifkan PIN pada booth tertentu.
            </p>
            <Link
              href="/owner-dashboard/machines"
              className={`${buttonClass} mt-4 inline-flex items-center`}
            >
              Kelola PIN Lock per booth
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t-4 border-border pt-5">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className={`${buttonClass} bg-foreground px-6 text-background`}
            >
              {isPending ? 'Memproses…' : 'Simpan draft'}
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={isPending || !contrast.ok}
              className={`${buttonClass} bg-main px-6`}
            >
              Publikasikan
            </button>
            <span className="text-muted-foreground text-sm">
              Publikasi mengirim event THEME_UPDATED ke kiosk tenant ini.
            </span>
          </div>
        </div>

        <aside className="space-y-6" aria-labelledby="preview-heading">
          <div className="space-y-3">
            <div className="flex items-end justify-between border-b-2 border-border pb-3">
              <div>
                <p className="text-muted-foreground text-sm font-bold">PRATINJAU LANGSUNG</p>
                <h2 id="preview-heading" className="mt-1 text-2xl font-extrabold">
                  {KIOSK_ORIENTATION_LABELS[draft.orientation]}
                </h2>
              </div>
              <span className="font-mono text-xs font-bold">
                {draft.panelStyle} · {draft.orientation}
              </span>
            </div>
            <div
              aria-label={`Pratinjau kiosk ${KIOSK_ORIENTATION_LABELS[draft.orientation]}, gaya panel ${draft.panelStyle}`}
              className="mx-auto p-5 shadow-[6px_6px_0_0_var(--color-border)]"
              style={{
                backgroundColor: hex(draft.backgroundColor),
                fontFamily: fontStack(draft.fontFamily),
                aspectRatio: isPortrait ? '9 / 16' : '16 / 9',
                width: isPortrait ? 'min(100%, 16rem)' : '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                justifyContent: 'space-between',
              }}
            >
              <div className="flex items-center gap-3">
                {draft.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL eksternal pilihan owner, tidak lewat optimizer.
                  <img
                    src={draft.logoUrl}
                    alt="Logo kiosk"
                    className="max-h-10 max-w-[6rem] object-contain"
                  />
                ) : (
                  <span
                    className="border-2 px-2 py-1 text-xs font-black"
                    style={{ borderColor: hex(draft.primaryColor) }}
                  >
                    LOGO
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {draft.welcomeText && (
                  <p className="text-lg font-bold" style={{ color: onSurface }}>
                    {draft.welcomeText}
                  </p>
                )}
                <p className="text-sm" style={{ color: onSurface }}>
                  Sentuh untuk memulai
                </p>
              </div>

              <div className="space-y-2">
                <div
                  className={`flex min-h-12 items-center justify-center px-4 text-center font-extrabold ${
                    draft.panelStyle === 'RECEIPT'
                      ? 'border-2 border-dashed border-black'
                      : draft.panelStyle === 'CARD'
                        ? 'border-4 border-black shadow-[4px_4px_0_0_#1A1A1A]'
                        : 'border-4 border-black'
                  }`}
                  style={{
                    backgroundColor: hex(draft.primaryColor),
                    color: onPrimary,
                  }}
                >
                  {draft.ctaText}
                </div>
                <div
                  className="flex min-h-10 items-center justify-center border-2 border-black px-4 text-center text-sm font-bold"
                  style={{
                    backgroundColor: hex(draft.accentColor),
                    color: onAccent,
                  }}
                >
                  Paket · {KIOSK_PANEL_LABELS[draft.panelStyle]}
                </div>
              </div>
            </div>
          </div>

          <section aria-labelledby="history-heading" className="space-y-3">
            <div className="flex items-end justify-between border-b-2 border-border pb-3">
              <div>
                <p className="text-muted-foreground text-sm font-bold">RIWAYAT</p>
                <h2 id="history-heading" className="mt-1 text-2xl font-extrabold">
                  Versi terbit
                </h2>
              </div>
              <span className="font-mono text-sm">{data.versions.length}/5</span>
            </div>
            {data.versions.length === 0 ? (
              <p className="text-muted-foreground border-2 border-dashed border-border p-5 text-sm">
                Belum ada versi terbit. Publikasikan tema untuk menyimpan snapshot.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.versions.map((version) => (
                  <li
                    key={version.id}
                    className="border-2 border-border bg-background p-4 shadow-[3px_3px_0_0_var(--color-border)]"
                  >
                    <p className="font-bold">
                      {KIOSK_PANEL_LABELS[version.panelStyle]} ·{' '}
                      {KIOSK_ORIENTATION_LABELS[version.orientation]}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {new Date(version.createdAt).toLocaleString('id-ID')}
                    </p>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => restore(version.id)}
                      className={`${buttonClass} mt-3 w-full`}
                    >
                      Muat ke draft
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
