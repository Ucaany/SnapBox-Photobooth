'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageIntro, StatusBadge, toneForStatus } from '@/components/ceo-dashboard/panel';
import {
  formatPromoQuota,
  formatPromoValue,
  PROMO_TYPE_LABELS,
  PROMO_TYPES,
  promoCreateInputSchema,
  promoUpdateInputSchema,
  type EditablePromo,
  type PromoActionResult,
  type PromoDisplayStatus,
} from '@/lib/ceo-dashboard/promo-contract';

import { createPromo, deletePromo, togglePromo, updatePromo } from './actions';

/**
 * CRUD promo global CEO (PRD Task 1.10, Bab 6.F).
 *
 * Tiga jalur interaksi dalam satu rute:
 * - form "buat promo" selalu terlihat di atas tabel (fokus utama halaman),
 * - dialog edit per baris, memakai skema kontrak yang SAMA dengan server action,
 * - aksi status: aktif/nonaktif satu klik, dan nonaktifkan permanen dengan
 *   alasan wajib (soft delete, histori redemption tetap utuh).
 *
 * Tidak ada optimisme palsu: setiap aksi menunggu konfirmasi server lalu
 * `router.refresh()` menarik nilai DB. Status tampilan dihitung server, bukan di
 * sini, supaya badge tidak pernah berbeda dari kebenaran kanonik.
 *
 * Design Read: dashboard operasional CEO yang padat, neobrutalist SnapBox, dial
 * ENERGY 2 / RHYTHM 2 / MOTION 1. Form dan tabel adalah dua blok fokus; aksen
 * hanya mengarahkan ke aksi primary dan feedback.
 */

interface Draft {
  name: string;
  code: string;
  type: EditablePromo['type'];
  value: string;
  minPurchase: string;
  validFrom: string;
  validUntil: string;
  quotaTotal: string;
  quotaPerCustomer: string;
}

interface RowFeedback {
  readonly tone: 'ok' | 'error';
  readonly message: string;
}

/** Bentuk nilai `<input type="datetime-local">` dari ISO UTC. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toDraft(row: EditablePromo): Draft {
  return {
    name: row.name ?? '',
    code: row.code,
    type: row.type,
    value: String(Number(row.value)),
    minPurchase: String(Number(row.minPurchase)),
    validFrom: toLocalInput(row.validFrom),
    validUntil: toLocalInput(row.validUntil),
    quotaTotal: row.quotaTotal === null ? '' : String(row.quotaTotal),
    quotaPerCustomer: String(row.quotaPerCustomer),
  };
}

function emptyDraft(): Draft {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    name: '',
    code: '',
    type: 'PERCENTAGE',
    value: '10',
    minPurchase: '0',
    validFrom: toLocalInput(now.toISOString()),
    validUntil: toLocalInput(nextMonth.toISOString()),
    quotaTotal: '',
    quotaPerCustomer: '1',
  };
}

function collectIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path.join('.') || 'form'] ??= issue.message;
  return errors;
}

export function PromosEditor({ promos }: { readonly promos: readonly EditablePromo[] }) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'' | PromoDisplayStatus>('');
  const [feedback, setFeedback] = React.useState<RowFeedback | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<EditablePromo | null>(null);
  const [confirming, setConfirming] = React.useState<EditablePromo | null>(null);

  const router = useRouter();

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return promos.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (needle) {
        const haystack = `${row.code} ${row.name ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [promos, query, statusFilter]);

  const activeCount = promos.filter((row) => row.status === 'Aktif').length;
  const activeFilterCount = (statusFilter ? 1 : 0) + (query ? 1 : 0);

  async function runAction(id: string, action: () => Promise<PromoActionResult>) {
    if (pendingId) return false;
    setPendingId(id);
    setFeedback(null);
    try {
      const result = await action();
      if (!result.ok) {
        setFeedback({ tone: 'error', message: result.message });
        return false;
      }
      setFeedback({ tone: 'ok', message: result.message });
      router.refresh();
      return true;
    } catch {
      setFeedback({ tone: 'error', message: 'Aksi gagal karena gangguan koneksi. Coba lagi.' });
      return false;
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <PageIntro
        title="Promo global"
        description="Voucher platform-wide: aktif/nonaktif, masa berlaku, dan kuota pemakaian."
      >
        <StatusBadge tone="info">{activeCount} aktif</StatusBadge>
      </PageIntro>

      <CreatePromoForm
        disabled={pendingId !== null}
        onFeedback={setFeedback}
        onDone={() => router.refresh()}
      />

      {feedback ? (
        <p
          className={feedback.tone === 'ok' ? 'ceo-feedback' : 'ceo-feedback ceo-feedback-error'}
          role={feedback.tone === 'ok' ? 'status' : 'alert'}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      ) : null}

      <section className="ceo-panel" aria-label="Filter promo">
        <div className="ceo-toolbar">
          <div className="ceo-field ceo-field-search">
            <label className="ceo-label" htmlFor="promo-search">
              Cari promo
            </label>
            <Input
              id="promo-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari kode atau nama promo"
              autoComplete="off"
            />
          </div>

          <div className="ceo-field">
            <label className="ceo-label" htmlFor="promo-status">
              Filter status
            </label>
            <NativeSelect
              id="promo-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | PromoDisplayStatus)}
            >
              <NativeSelectOption value="">Semua</NativeSelectOption>
              {(['Aktif', 'Terjadwal', 'Berakhir', 'Nonaktif'] as const).map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {status}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {activeFilterCount > 0 ? (
            <div className="ceo-toolbar-actions">
              <Button
                type="button"
                variant="noShadow"
                size="default"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('');
                }}
              >
                Reset ({activeFilterCount})
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="ceo-table-wrap">
        {promos.length === 0 ? (
          <div className="ceo-table-state" role="status">
            <p className="ceo-table-state-title">Belum ada promo global.</p>
            <p>Buat voucher platform-wide dengan form di atas. Kode aktif langsung bisa dipakai.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ceo-table-state" role="status">
            <p className="ceo-table-state-title">Tidak ada promo yang cocok.</p>
            <p>Ubah kata kunci atau kosongkan filter untuk melihat semua promo.</p>
            <Button
              type="button"
              variant="neutral"
              size="default"
              onClick={() => {
                setQuery('');
                setStatusFilter('');
              }}
            >
              Kosongkan filter
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Kode</TableHead>
                  <TableHead scope="col">Bentuk promo</TableHead>
                  <TableHead scope="col">Periode</TableHead>
                  <TableHead scope="col">Kuota</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const pending = pendingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="ceo-cell-stack">
                          <span className="ceo-mono ceo-cell-strong">{row.code}</span>
                          {row.name ? <span className="ceo-cell-sub">{row.name}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="ceo-cell-stack">
                          <span>{PROMO_TYPE_LABELS[row.type]}</span>
                          <span className="ceo-cell-sub">
                            {formatPromoValue(row.type, row.value)}
                            {Number(row.minPurchase) > 0
                              ? ` - min ${formatPromoValue('FIXED_AMOUNT', row.minPurchase)}`
                              : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="ceo-cell-stack">
                          <span>{formatDateTime(row.validFrom)}</span>
                          <span className="ceo-cell-sub">s/d {formatDateTime(row.validUntil)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="ceo-mono">
                        {formatPromoQuota(row.quotaUsed, row.quotaTotal)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="ceo-inline-actions">
                          <Button
                            type="button"
                            variant="neutral"
                            size="sm"
                            onClick={() => setEditing(row)}
                            disabled={pending}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="noShadow"
                            size="sm"
                            onClick={() =>
                              void runAction(row.id, () =>
                                togglePromo({ promoId: row.id, isActive: !row.isActive }),
                              )
                            }
                            disabled={pending}
                          >
                            {row.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                          <Button
                            type="button"
                            variant="reverse"
                            size="sm"
                            onClick={() => setConfirming(row)}
                            disabled={pending}
                          >
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="ceo-table-count" role="status">
              Menampilkan {filtered.length} dari {promos.length} promo global.
            </p>
          </>
        )}
      </div>

      {editing ? (
        <EditPromoDialog
          promo={editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setFeedback({ tone: 'ok', message });
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {confirming ? (
        <DeletePromoDialog
          promo={confirming}
          pending={pendingId === confirming.id}
          onClose={() => setConfirming(null)}
          onConfirm={async (reason) => {
            const ok = await runAction(confirming.id, () =>
              deletePromo({ promoId: confirming.id, reason }),
            );
            if (ok) setConfirming(null);
          }}
        />
      ) : null}

      <p className="ceo-footnote">
        Promo global berlaku lintas tenant dan tampil di kiosk setelah aktif. Menghapus promo hanya
        menonaktifkannya; riwayat pemakaian tetap tersimpan untuk audit. Redeem di kiosk tunduk pada
        kuota, masa berlaku, dan minimum pembelian yang diatur di sini.
      </p>
    </>
  );
}

/** Form buat promo; blok dengan aksen primary sebagai pengarah fokus utama. */
function CreatePromoForm({
  onDone,
  onFeedback,
  disabled,
}: {
  onDone: () => void;
  onFeedback: (feedback: RowFeedback) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;

    const parsed = promoCreateInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error.issues));
      onFeedback({ tone: 'error', message: 'Periksa kembali nilai yang diisi.' });
      return;
    }

    setPending(true);
    setErrors({});
    try {
      const result = await createPromo(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        onFeedback({ tone: 'error', message: result.message });
        return;
      }
      onFeedback({ tone: 'ok', message: result.message });
      setDraft(emptyDraft());
      onDone();
    } catch {
      onFeedback({
        tone: 'error',
        message: 'Penyimpanan gagal karena gangguan koneksi. Coba lagi.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="ceo-promo-create">
      <CardHeader className="ceo-promo-card-head">
        <CardTitle className="ceo-promo-title">
          Buat promo baru
          <Badge variant="neutral">Platform-wide</Badge>
        </CardTitle>
        <p className="ceo-muted">
          Kode tidak peka huruf besar/kecil dan dinormalkan menjadi huruf kapital.
        </p>
      </CardHeader>
      <CardContent>
        <form className="ceo-form" onSubmit={submit} noValidate>
          <PromoFields draft={draft} errors={errors} onChange={set} idPrefix="create" />
          <div className="ceo-inline-actions">
            <Button
              type="submit"
              variant="default"
              disabled={pending || disabled}
              aria-busy={pending}
            >
              {pending ? 'Menyimpan...' : 'Simpan promo'}
            </Button>
            <Button
              type="button"
              variant="neutral"
              onClick={() => {
                setDraft(emptyDraft());
                setErrors({});
              }}
              disabled={pending}
            >
              Kosongkan form
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Dialog edit; memvalidasi dengan skema update yang sama seperti server. */
function EditPromoDialog({
  promo,
  onClose,
  onSaved,
}: {
  promo: EditablePromo;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(promo));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = promoUpdateInputSchema.safeParse({
      ...draft,
      promoId: promo.id,
      quotaUsed: promo.quotaUsed,
    });
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error.issues));
      setFeedback('Periksa kembali nilai yang diisi.');
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback(null);
    try {
      const result = await updatePromo(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFeedback(result.message);
        return;
      }
      onSaved(result.message);
    } catch {
      setFeedback('Penyimpanan gagal karena gangguan koneksi. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ceo-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ceo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="promo-edit-title">Edit promo {promo.code}</h3>
        <p className="ceo-muted">
          Terpakai {formatPromoQuota(promo.quotaUsed, promo.quotaTotal)}. Kuota total tidak boleh
          diturunkan di bawah jumlah terpakai.
        </p>

        <form className="ceo-form" onSubmit={submit} noValidate>
          <PromoFields draft={draft} errors={errors} onChange={set} idPrefix="edit" />

          {feedback ? (
            <p className="ceo-feedback ceo-feedback-error" role="alert">
              {feedback}
            </p>
          ) : null}

          <div className="ceo-wizard-actions">
            <Button type="button" variant="noShadow" onClick={onClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" variant="default" disabled={pending} aria-busy={pending}>
              {pending ? 'Menyimpan...' : 'Simpan perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Konfirmasi nonaktifkan permanen; alasan wajib dan ikut tercatat di audit. */
function DeletePromoDialog({
  promo,
  pending,
  onClose,
  onConfirm,
}: {
  promo: EditablePromo;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="ceo-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ceo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="promo-delete-title">Nonaktifkan promo {promo.code}?</h3>
        <p>
          Kode tidak bisa lagi dipakai di kiosk. Baris promo dan riwayat pemakaian tetap tersimpan
          untuk audit; aktifkan kembali kapan saja bila promo ingin dipakai lagi.
        </p>

        <div className="ceo-field-block">
          <label htmlFor="promo-delete-reason">Alasan (wajib, tercatat di audit)</label>
          <Textarea
            id="promo-delete-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            required
            minLength={4}
          />
        </div>

        <div className="ceo-wizard-actions">
          <Button type="button" variant="noShadow" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button
            type="button"
            variant="reverse"
            onClick={() => onConfirm(reason.trim())}
            disabled={pending || reason.trim().length < 4}
            aria-busy={pending}
          >
            {pending ? 'Memproses...' : 'Nonaktifkan promo'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Field bersama create/edit; satu sumber supaya dua form tidak menyimpang. */
function PromoFields({
  draft,
  errors,
  onChange,
  idPrefix,
}: {
  draft: Draft;
  errors: Readonly<Record<string, string>>;
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  idPrefix: string;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  const isPercentage = draft.type === 'PERCENTAGE';

  return (
    <div className="ceo-promo-grid">
      <Field id={id('code')} label="Kode" error={errors.code} hint="4-20 karakter alfanumerik.">
        <Input
          id={id('code')}
          value={draft.code}
          onChange={(event) => onChange('code', event.target.value.toUpperCase())}
          placeholder="PROMO2026"
          autoComplete="off"
          required
        />
      </Field>

      <Field id={id('name')} label="Nama (opsional)" error={errors.name}>
        <Input
          id={id('name')}
          value={draft.name}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="Promo Lebaran"
        />
      </Field>

      <Field id={id('type')} label="Tipe" error={errors.type}>
        <NativeSelect
          id={id('type')}
          value={draft.type}
          onChange={(event) => onChange('type', event.target.value as EditablePromo['type'])}
        >
          {PROMO_TYPES.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {PROMO_TYPE_LABELS[type]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field
        id={id('value')}
        label={isPercentage ? 'Diskon (%)' : 'Diskon (Rp)'}
        error={errors.value}
        hint={isPercentage ? 'Maksimal 100.' : undefined}
      >
        <Input
          id={id('value')}
          inputMode="decimal"
          value={draft.value}
          onChange={(event) => onChange('value', event.target.value)}
          required
        />
      </Field>

      <Field
        id={id('minPurchase')}
        label="Minimum pembelian (Rp)"
        error={errors.minPurchase}
        hint="Isi 0 bila tanpa minimum."
      >
        <Input
          id={id('minPurchase')}
          inputMode="decimal"
          value={draft.minPurchase}
          onChange={(event) => onChange('minPurchase', event.target.value)}
        />
      </Field>

      <Field
        id={id('quotaTotal')}
        label="Kuota total"
        error={errors.quotaTotal}
        hint="Kosongkan untuk tanpa batas."
      >
        <Input
          id={id('quotaTotal')}
          inputMode="numeric"
          value={draft.quotaTotal}
          onChange={(event) => onChange('quotaTotal', event.target.value)}
          placeholder="Tanpa batas"
        />
      </Field>

      <Field id={id('quotaPerCustomer')} label="Kuota per customer" error={errors.quotaPerCustomer}>
        <Input
          id={id('quotaPerCustomer')}
          inputMode="numeric"
          value={draft.quotaPerCustomer}
          onChange={(event) => onChange('quotaPerCustomer', event.target.value)}
        />
      </Field>

      <Field id={id('validFrom')} label="Mulai berlaku" error={errors.validFrom}>
        <Input
          id={id('validFrom')}
          type="datetime-local"
          value={draft.validFrom}
          onChange={(event) => onChange('validFrom', event.target.value)}
          required
        />
      </Field>

      <Field id={id('validUntil')} label="Berakhir" error={errors.validUntil}>
        <Input
          id={id('validUntil')}
          type="datetime-local"
          value={draft.validUntil}
          onChange={(event) => onChange('validUntil', event.target.value)}
          required
        />
      </Field>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="ceo-field-block ceo-promo-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="ceo-muted">{hint}</p> : null}
      {error ? (
        <p className="ceo-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
