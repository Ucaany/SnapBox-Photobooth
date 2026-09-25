'use client';

import { Button, NativeSelect, NativeSelectOption, Textarea } from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  statusTransitionError,
  tenantActionInputSchema,
  type TenantAction,
  type TenantPlanOption,
} from '@/lib/ceo-dashboard/tenant-contract';

import { changeTenantStatus, deleteTenant, downgradeTenant, resetTenantInvite } from '../actions';

/**
 * Aksi mutasi tenant (PRD Task 1.4 + 1.8): suspend, ban, restore, reset
 * undangan, downgrade, dan soft delete.
 *
 * Tiga aturan yang membentuk komponen ini:
 * 1. Setiap aksi destruktif butuh confirmation eksplisit + alasan tertulis;
 *    tombol kirim tetap nonaktif sampai alasan memenuhi panjang minimum.
 * 2. Aksi yang tidak valid untuk status saat ini TIDAK dirender sebagai tombol
 *    mati, melainkan dijelaskan sebagai teks.
 * 3. Tidak ada optimisme palsu: setelah sukses, `router.refresh()` memuat ulang
 *    data server sehingga badge status/plan berasal dari DB, bukan state lokal.
 */
type ActionKind = Extract<
  TenantAction,
  'suspend' | 'ban' | 'restore' | 'reset' | 'downgrade' | 'delete'
>;

interface ActionSpec {
  readonly kind: ActionKind;
  readonly label: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive: boolean;
}

const ACTIONS: readonly ActionSpec[] = [
  {
    kind: 'suspend',
    label: 'Suspend',
    description: 'Menghentikan akses sementara; akun Owner di Firebase ikut dinonaktifkan.',
    confirmLabel: 'Suspend tenant',
    destructive: true,
  },
  {
    kind: 'ban',
    label: 'Ban',
    description: 'Memblokir tenant secara permanen sampai dipulihkan manual.',
    confirmLabel: 'Ban tenant',
    destructive: true,
  },
  {
    kind: 'restore',
    label: 'Restore',
    description: 'Mengembalikan tenant ke ACTIVE dan mengaktifkan kembali akun Owner.',
    confirmLabel: 'Pulihkan tenant',
    destructive: false,
  },
  {
    kind: 'reset',
    label: 'Reset & kirim ulang undangan',
    description: 'Membuat tautan kata sandi baru dan mengirimkannya ulang ke Owner.',
    confirmLabel: 'Kirim ulang undangan',
    destructive: false,
  },
  {
    kind: 'downgrade',
    label: 'Downgrade plan',
    description: 'Menurunkan plan tenant dan mencatat langganan baru berstatus PENDING.',
    confirmLabel: 'Turunkan plan',
    destructive: true,
  },
  {
    kind: 'delete',
    label: 'Hapus tenant',
    description:
      'Soft delete: status DELETED, Owner dinonaktifkan, data dipertahankan untuk retensi 30 hari.',
    confirmLabel: 'Hapus tenant',
    destructive: true,
  },
];

export function TenantDetailActions({
  tenantId,
  status,
  planTier,
  planOptions,
}: {
  tenantId: string;
  status: string;
  planTier: TenantPlanOption['tier'];
  planOptions: readonly TenantPlanOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<ActionKind | null>(null);
  const [reason, setReason] = React.useState('');
  const [targetTier, setTargetTier] = React.useState<TenantPlanOption['tier']>(
    planOptions.find((plan) => plan.tier !== planTier)?.tier ?? planTier,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Escape menutup panel konfirmasi. Handler dipasang hanya saat dialog terbuka.
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(null);
        setReason('');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function openDialog(kind: ActionKind) {
    setOpen(kind);
    setReason('');
    setError(null);
    setFeedback(null);
  }

  function closeDialog() {
    setOpen(null);
    setReason('');
  }

  /**
   * Aksi yang tidak valid untuk status saat ini, beserta alasannya.
   *
   * Aturan status dibaca dari matriks bersama di kontrak, sehingga client dan
   * server action tidak bisa menyimpang. Hanya kendala khusus UI (plan tujuan,
   * ketersediaan plan alternatif) yang ditambahkan di sini.
   */
  function unavailableReason(spec: ActionSpec): string | null {
    if (spec.kind === 'downgrade') {
      if (planOptions.length < 2) return 'Belum ada plan lain yang bisa dipilih.';
      if (targetTier === planTier) return 'Pilih plan tujuan yang berbeda dari plan saat ini.';
      return null;
    }

    // `reset` bukan transisi status: gate akses ada di server (BLOCKED tenant).
    if (spec.kind === 'reset') return null;

    // `delete` bersifat terminal dan boleh dari status apa pun kecuali DELETED.
    if (spec.kind === 'delete') {
      return status === 'DELETED' ? 'Tenant sudah dihapus.' : null;
    }

    return statusTransitionError(status, spec.kind);
  }

  async function submit(spec: ActionSpec) {
    if (pending) return;

    const parsed = tenantActionInputSchema.safeParse({
      tenantId,
      action: spec.kind,
      reason,
      ...(spec.kind === 'downgrade' ? { planTier: targetTier } : {}),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Aksi tidak valid.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response =
        spec.kind === 'downgrade'
          ? await downgradeTenant(parsed.data)
          : spec.kind === 'reset'
            ? await resetTenantInvite(parsed.data)
            : spec.kind === 'delete'
              ? await deleteTenant(parsed.data)
              : await changeTenantStatus(parsed.data);

      if (!response.ok) {
        setError(response.message);
        return;
      }

      setFeedback(response.message);
      setOpen(null);
      setReason('');

      // Setelah soft delete halaman ini akan 404 (`deletedAt` difilter), jadi
      // pindah ke daftar alih-alih refresh detail yang sudah tidak ada.
      if (spec.kind === 'delete') {
        router.push('/ceo-dashboard/tenants');
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      setError('Aksi gagal karena gangguan koneksi. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  const activeSpec = open ? (ACTIONS.find((spec) => spec.kind === open) ?? null) : null;

  return (
    <section className="ceo-panel ceo-tenant-actions" aria-label="Aksi tenant">
      <h2>Aksi tenant</h2>
      <p className="ceo-muted">
        Semua aksi meminta konfirmasi dan alasan, lalu dicatat di activity log. Status langganan
        hanya berubah lewat webhook pembayaran terverifikasi.
      </p>

      {feedback ? (
        <p className="ceo-feedback" role="status">
          {feedback}
        </p>
      ) : null}

      <ul className="ceo-action-grid">
        {ACTIONS.map((spec) => {
          const blocked = unavailableReason(spec);
          return (
            <li key={spec.kind}>
              <p className="ceo-cell-strong">{spec.label}</p>
              <p className="ceo-muted">{spec.description}</p>
              {blocked ? (
                <p className="ceo-muted">{blocked}</p>
              ) : (
                <Button
                  type="button"
                  variant={spec.destructive ? 'reverse' : 'neutral'}
                  size="sm"
                  onClick={() => openDialog(spec.kind)}
                >
                  {spec.label}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {open && activeSpec ? (
        <div className="ceo-dialog-backdrop" role="presentation" onClick={closeDialog}>
          <div
            ref={dialogRef}
            className="ceo-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-action-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="tenant-action-title">{activeSpec.confirmLabel}</h3>
            <p>{activeSpec.description}</p>

            {activeSpec.kind === 'downgrade' ? (
              <div className="ceo-field-block">
                <label htmlFor="target-tier">Plan tujuan</label>
                <NativeSelect
                  id="target-tier"
                  value={targetTier}
                  onChange={(event) =>
                    setTargetTier(event.target.value as TenantPlanOption['tier'])
                  }
                >
                  {planOptions.map((plan) => (
                    <NativeSelectOption key={plan.tier} value={plan.tier}>
                      {plan.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            <div className="ceo-field-block">
              <label htmlFor="action-reason">Alasan (wajib)</label>
              <Textarea
                id="action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={4}
                rows={3}
              />
            </div>

            {error ? (
              <p className="ceo-feedback ceo-feedback-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ceo-wizard-actions">
              <Button type="button" variant="noShadow" onClick={closeDialog} disabled={pending}>
                Batal
              </Button>
              <Button
                type="button"
                variant={activeSpec.destructive ? 'reverse' : 'default'}
                onClick={() => submit(activeSpec)}
                disabled={pending || reason.trim().length < 4}
                aria-busy={pending}
              >
                {pending ? 'Memproses...' : activeSpec.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
