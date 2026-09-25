'use client';

import { Button, Input, NativeSelect, NativeSelectOption } from '@snapbox/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  billingPeriodSchema,
  createTenantInputSchema,
  tenantClientDetailsSchema,
  tenantPlanSchema,
  type BillingPeriod,
  type TenantPlanOption,
} from '@/lib/ceo-dashboard/tenant-contract';

import { createTenant } from '../actions';

/**
 * Wizard provisioning tenant tiga langkah (PRD Task 1.4).
 *
 * Validasi terjadi dua kali: di sini agar CEO dapat umpan balik cepat, dan di
 * server action karena input browser tidak pernah dipercaya. Karena itu skema
 * langkah diimpor dari kontrak yang sama, bukan disalin.
 *
 * Yang sengaja tidak dibuat: penyimpanan draft, navigasi bebas antar langkah,
 * dan tombol "lewati". Wizard provisioning akun berbayar lebih baik kaku.
 */
const STEPS = ['Client Details', 'Plan & Duration', 'Review & Invite'] as const;

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Bulanan',
  yearly: 'Tahunan',
};

interface FormState {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
  planTier: TenantPlanOption['tier'];
  billingPeriod: BillingPeriod;
  sendInvite: boolean;
  notes: string;
}

export function TenantProvisioningWizard({
  planOptions,
}: {
  planOptions: readonly TenantPlanOption[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: true;
    tenantId: string;
    message: string;
  } | null>(null);

  const defaultTier = planOptions[0]?.tier ?? 'STARTER';
  const [form, setForm] = React.useState<FormState>({
    companyName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: '',
    planTier: defaultTier,
    billingPeriod: 'monthly',
    sendInvite: true,
    notes: '',
  });

  const selectedPlan = planOptions.find((plan) => plan.tier === form.planTier) ?? planOptions[0];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Validasi per langkah; mengembalikan `true` bila langkah boleh lanjut. */
  function validateStep(index: number): boolean {
    setFormError(null);

    if (index === 0) {
      const parsed = tenantClientDetailsSchema.safeParse({
        companyName: form.companyName,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPhone: form.ownerPhone || undefined,
        address: form.address || undefined,
      });
      if (!parsed.success) {
        setErrors(collectIssues(parsed.error.issues));
        return false;
      }
    }

    if (index === 1) {
      const parsed = tenantPlanSchema.safeParse({
        planTier: form.planTier,
        billingPeriod: form.billingPeriod,
      });
      if (!parsed.success) {
        setErrors(collectIssues(parsed.error.issues));
        return false;
      }
    }

    setErrors({});
    return true;
  }

  function next() {
    if (validateStep(step)) setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function back() {
    setErrors({});
    setFormError(null);
    setStep((value) => Math.max(value - 1, 0));
  }

  async function submit() {
    if (pending) return;

    const parsed = createTenantInputSchema.safeParse({
      companyName: form.companyName,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPhone: form.ownerPhone || undefined,
      address: form.address || undefined,
      planTier: form.planTier,
      billingPeriod: billingPeriodSchema.parse(form.billingPeriod),
      sendInvite: form.sendInvite,
      notes: form.notes || undefined,
    });

    if (!parsed.success) {
      const issues = collectIssues(parsed.error.issues);
      setErrors(issues);
      // Lompat ke langkah pertama yang bermasalah supaya pesan tidak tersembunyi.
      if (
        issues.companyName ||
        issues.ownerName ||
        issues.ownerEmail ||
        issues.ownerPhone ||
        issues.address
      ) {
        setStep(0);
      } else {
        setStep(1);
      }
      setFormError('Beberapa isian belum valid. Periksa kembali sebelum mengirim.');
      return;
    }

    setPending(true);
    setErrors({});
    setFormError(null);

    try {
      const response = await createTenant(parsed.data);
      if (!response.ok) {
        setErrors(response.fieldErrors ?? {});
        setFormError(response.message);
        return;
      }

      setResult({ ok: true, tenantId: response.tenantId, message: response.message });
      router.refresh();
    } catch {
      setFormError('Pengiriman gagal karena gangguan koneksi. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <section className="ceo-panel ceo-wizard-done" aria-live="polite">
        <p className="ceo-kicker">Langkah selesai</p>
        <h1>Tenant dibuat</h1>
        <p className="ceo-feedback" role="status">
          {result.message}
        </p>
        <div className="ceo-inline-actions">
          <Button
            variant="default"
            render={<Link href={`/ceo-dashboard/tenants/${result.tenantId}`} />}
          >
            Buka detail tenant
          </Button>
          <Button variant="neutral" render={<Link href="/ceo-dashboard/tenants" />}>
            Kembali ke daftar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="ceo-panel ceo-wizard" aria-label="Wizard tenant baru">
      <ol className="ceo-steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className="ceo-step"
            data-state={index === step ? 'current' : index < step ? 'done' : 'todo'}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="ceo-step-index" aria-hidden>
              {index + 1}
            </span>
            <span className="ceo-step-label">{label}</span>
          </li>
        ))}
      </ol>

      {formError ? (
        <p className="ceo-feedback ceo-feedback-error" role="alert">
          {formError}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="ceo-form">
          <Field id="companyName" label="Nama perusahaan" error={errors.companyName}>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(event) => update('companyName', event.target.value)}
              required
            />
          </Field>
          <Field id="ownerName" label="Nama penanggung jawab" error={errors.ownerName}>
            <Input
              id="ownerName"
              value={form.ownerName}
              onChange={(event) => update('ownerName', event.target.value)}
              required
            />
          </Field>
          <Field
            id="ownerEmail"
            label="Email Owner"
            error={errors.ownerEmail}
            hint="Undangan dan tautan penetapan kata sandi dikirim ke alamat ini."
          >
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={(event) => update('ownerEmail', event.target.value)}
              required
            />
          </Field>
          <Field id="ownerPhone" label="Telepon Owner (opsional)" error={errors.ownerPhone}>
            <Input
              id="ownerPhone"
              value={form.ownerPhone}
              onChange={(event) => update('ownerPhone', event.target.value)}
            />
          </Field>
          <Field id="address" label="Alamat (opsional)" error={errors.address}>
            <Input
              id="address"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="ceo-form">
          <Field id="planTier" label="Plan" error={errors.planTier}>
            <NativeSelect
              id="planTier"
              value={form.planTier}
              onChange={(event) =>
                update('planTier', event.target.value as TenantPlanOption['tier'])
              }
            >
              {planOptions.map((plan) => (
                <NativeSelectOption key={plan.tier} value={plan.tier}>
                  {plan.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="billingPeriod" label="Durasi" error={errors.billingPeriod}>
            <NativeSelect
              id="billingPeriod"
              value={form.billingPeriod}
              onChange={(event) => update('billingPeriod', event.target.value as BillingPeriod)}
            >
              {(['monthly', 'yearly'] as const).map((period) => (
                <NativeSelectOption key={period} value={period}>
                  {PERIOD_LABELS[period]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="notes" label="Catatan internal (opsional)" error={errors.notes}>
            <Input
              id="notes"
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </Field>
          {selectedPlan ? (
            <p className="ceo-muted">
              {selectedPlan.name}: {formatRupiah(selectedPlan.priceMonthly)} per bulan,{' '}
              {selectedPlan.deviceIncluded} perangkat, {selectedPlan.staffLimit} akun staff.
            </p>
          ) : (
            <p className="ceo-feedback ceo-feedback-error" role="alert">
              Belum ada plan aktif. Jalankan seed plan sebelum membuat tenant.
            </p>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="ceo-review">
          <dl className="ceo-review-list">
            <ReviewRow label="Perusahaan" value={form.companyName} />
            <ReviewRow label="Owner" value={`${form.ownerName} (${form.ownerEmail})`} />
            <ReviewRow label="Telepon" value={form.ownerPhone || 'Tidak diisi'} />
            <ReviewRow label="Alamat" value={form.address || 'Tidak diisi'} />
            <ReviewRow label="Plan" value={selectedPlan?.name ?? form.planTier} />
            <ReviewRow label="Durasi" value={PERIOD_LABELS[form.billingPeriod]} />
            <ReviewRow
              label="Perkiraan tagihan"
              value={
                selectedPlan
                  ? formatRupiah(
                      form.billingPeriod === 'yearly' && selectedPlan.priceYearly !== null
                        ? selectedPlan.priceYearly
                        : selectedPlan.priceMonthly,
                    )
                  : 'Tidak tersedia'
              }
            />
          </dl>

          <label className="ceo-checkbox">
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={(event) => update('sendInvite', event.target.checked)}
            />
            <span>Kirim email undangan sekarang</span>
          </label>
          <p className="ceo-muted">
            Undangan berisi tautan penetapan kata sandi Firebase. SnapBox tidak menyimpan kata sandi
            Owner. Langganan dibuat berstatus PENDING sampai pembayaran dikonfirmasi webhook.
          </p>
        </div>
      ) : null}

      <div className="ceo-wizard-actions">
        <Button type="button" variant="noShadow" onClick={back} disabled={step === 0 || pending}>
          Kembali
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="default" onClick={next} disabled={pending}>
            Lanjut
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            onClick={submit}
            disabled={pending || !selectedPlan}
            aria-busy={pending}
          >
            {pending ? 'Menyimpan...' : 'Buat tenant'}
          </Button>
        )}
        <Button variant="neutral" render={<Link href="/ceo-dashboard/tenants" />}>
          Batal
        </Button>
      </div>
    </section>
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
    <div className="ceo-field-block">
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ceo-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function collectIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
