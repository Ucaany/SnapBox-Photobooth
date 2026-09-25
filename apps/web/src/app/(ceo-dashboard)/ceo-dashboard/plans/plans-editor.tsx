'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  NativeSelect,
  NativeSelectOption,
  Switch,
} from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  CAMERA_TYPES,
  formatLimit,
  formatRupiah,
  PLAN_FEATURE_FIELDS,
  planUpdateInputSchema,
  UNLIMITED_LIMIT,
  type EditablePlan,
  type PlanActionResult,
  type PlanFeatureField,
} from '@/lib/ceo-dashboard/plan-contract';

import { updatePlan } from './actions';

/**
 * Editor harga & fitur plan (PRD Task 1.5).
 *
 * Satu draft form per plan, terisolasi dari plan lain. Validasi memakai skema
 * kontrak yang SAMA dengan server action, jadi pesan browser dan server tidak
 * bisa menyimpang. Setelah sukses, `router.refresh()` menarik nilai server
 * terbaru; nilai draft tetap ditampilkan sampai reload selesai.
 *
 * Tidak ada optimistic update: menyimpan harga plan adalah aksi berisiko, jadi
 * UI menunggu konfirmasi server sebelum menyatakan sukses.
 */
type FeatureValue = string | boolean | string[];

interface Draft {
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: Record<keyof EditablePlan['features'], FeatureValue>;
}

function toDraft(plan: EditablePlan): Draft {
  const features = {} as Draft['features'];
  for (const field of PLAN_FEATURE_FIELDS) {
    const value = plan.features[field.key];
    if (field.kind === 'boolean') features[field.key] = value as boolean;
    else if (field.kind === 'camera-list') features[field.key] = value as string[];
    else features[field.key] = String(value);
  }
  return {
    name: plan.name,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly ?? '',
    features,
  };
}

/** Bangun payload sesuai bentuk `planUpdateInputSchema` dari draft string. */
function toPayload(planId: string, draft: Draft): Record<string, unknown> {
  const features: Record<string, unknown> = {};
  for (const field of PLAN_FEATURE_FIELDS) {
    const value = draft.features[field.key];
    features[field.key] = field.kind === 'integer' ? Number(value) : value;
  }
  return {
    planId,
    name: draft.name,
    priceMonthly: draft.priceMonthly,
    priceYearly: draft.priceYearly.trim() === '' ? null : draft.priceYearly,
    features,
  };
}

function collectIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path.join('.') || 'form'] ??= issue.message;
  return errors;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function PlansEditor({ plans }: { plans: readonly EditablePlan[] }) {
  if (plans.length === 0) {
    return (
      <section className="ceo-panel-static" role="status">
        <p className="ceo-muted">
          Belum ada baris plan di database. Jalankan seed plan sebelum mengedit harga.
        </p>
      </section>
    );
  }

  return (
    <div className="ceo-plans-editor">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const baseline = React.useMemo(() => toDraft(plan), [plan]);
  const [draft, setDraft] = React.useState<Draft>(baseline);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState<{ tone: 'ok' | 'error'; message: string } | null>(
    null,
  );
  const [pending, setPending] = React.useState(false);

  // Server mengirim nilai baru setelah revalidation; sinkronkan draft.
  React.useEffect(() => {
    setDraft(baseline);
  }, [baseline]);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [baseline, draft],
  );

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setFeature(key: keyof EditablePlan['features'], value: FeatureValue) {
    setDraft((prev) => ({ ...prev, features: { ...prev.features, [key]: value } }));
  }

  function reset() {
    setDraft(baseline);
    setErrors({});
    setFeedback(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !dirty) return;

    const parsed = planUpdateInputSchema.safeParse(toPayload(plan.id, draft));
    if (!parsed.success) {
      setErrors(collectIssues(parsed.error.issues));
      setFeedback({ tone: 'error', message: 'Periksa kembali nilai yang diisi.' });
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback(null);

    try {
      const result: PlanActionResult = await updatePlan(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFeedback({ tone: 'error', message: result.message });
        return;
      }
      setFeedback({ tone: 'ok', message: result.message });
      router.refresh();
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Penyimpanan gagal karena gangguan koneksi. Coba lagi.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="ceo-plan-card">
      <CardHeader className="ceo-plan-card-head">
        <CardTitle className="ceo-plan-head">
          {plan.name}
          <Badge variant="neutral" className="ceo-mono">
            {plan.tier}
          </Badge>
          {!plan.isActive ? <Badge variant="neutral">Nonaktif</Badge> : null}
        </CardTitle>
        <p className="ceo-muted">
          Terakhir diperbarui {formatUpdatedAt(plan.updatedAt)} UTC. Harga baru berlaku untuk tenant
          baru dan renewal; subscription yang sedang berjalan tidak diubah.
        </p>
      </CardHeader>

      <CardContent>
        <form className="ceo-form" onSubmit={submit} noValidate>
          <div className="ceo-plan-prices">
            <Field id={`${plan.id}-name`} label="Nama plan" error={errors.name}>
              <Input
                id={`${plan.id}-name`}
                value={draft.name}
                onChange={(event) => setField('name', event.target.value)}
                required
              />
            </Field>
            <Field
              id={`${plan.id}-monthly`}
              label="Harga bulanan (Rp)"
              error={errors.priceMonthly}
              hint={formatRupiah(draft.priceMonthly || 0)}
            >
              <Input
                id={`${plan.id}-monthly`}
                inputMode="decimal"
                value={draft.priceMonthly}
                onChange={(event) => setField('priceMonthly', event.target.value)}
                required
              />
            </Field>
            <Field
              id={`${plan.id}-yearly`}
              label="Harga tahunan (Rp)"
              error={errors.priceYearly}
              hint="Kosongkan bila plan tidak menawarkan siklus tahunan."
            >
              <Input
                id={`${plan.id}-yearly`}
                inputMode="decimal"
                value={draft.priceYearly}
                onChange={(event) => setField('priceYearly', event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="ceo-plan-features">
            <legend>Feature entitlement</legend>
            {PLAN_FEATURE_FIELDS.map((field) => (
              <FeatureField
                key={field.key}
                planId={plan.id}
                field={field}
                value={draft.features[field.key]}
                error={errors[`features.${field.key}`]}
                onChange={(value) => setFeature(field.key, value)}
              />
            ))}
          </fieldset>

          {feedback ? (
            <p
              className={
                feedback.tone === 'ok' ? 'ceo-feedback' : 'ceo-feedback ceo-feedback-error'
              }
              role={feedback.tone === 'ok' ? 'status' : 'alert'}
            >
              {feedback.message}
            </p>
          ) : null}

          <div className="ceo-inline-actions">
            <Button type="submit" variant="default" disabled={pending || !dirty}>
              {pending ? 'Menyimpan...' : dirty ? 'Simpan perubahan' : 'Tidak ada perubahan'}
            </Button>
            <Button type="button" variant="neutral" onClick={reset} disabled={pending || !dirty}>
              Batalkan perubahan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FeatureField({
  planId,
  field,
  value,
  error,
  onChange,
}: {
  planId: string;
  field: PlanFeatureField;
  value: FeatureValue;
  error?: string | undefined;
  onChange: (value: FeatureValue) => void;
}) {
  const id = `${planId}-${field.key}`;

  if (field.kind === 'boolean') {
    return (
      <div className="ceo-feature-row">
        <label htmlFor={id}>{field.label}</label>
        <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
        {error ? (
          <p className="ceo-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'camera-list') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="ceo-feature-row ceo-feature-row-wide">
        <span className="ceo-feature-label">{field.label}</span>
        <div className="ceo-checkbox-group" role="group" aria-label={field.label}>
          {CAMERA_TYPES.map((option) => (
            <label key={option} className="ceo-checkbox" htmlFor={`${id}-${option}`}>
              <Checkbox
                id={`${id}-${option}`}
                checked={selected.includes(option)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked ? [...selected, option] : selected.filter((item) => item !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
        {field.hint ? <p className="ceo-muted">{field.hint}</p> : null}
        {error ? (
          <p className="ceo-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'enum') {
    return (
      <div className="ceo-feature-row">
        <label htmlFor={id}>{field.label}</label>
        <NativeSelect
          id={id}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {error ? (
          <p className="ceo-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'text') {
    return (
      <div className="ceo-feature-row">
        <label htmlFor={id}>{field.label}</label>
        <Input id={id} value={String(value)} onChange={(event) => onChange(event.target.value)} />
        {error ? (
          <p className="ceo-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const numeric = String(value);
  return (
    <div className="ceo-feature-row">
      <label htmlFor={id}>{field.label}</label>
      <div className="ceo-feature-input">
        <Input
          id={id}
          inputMode="numeric"
          value={numeric}
          onChange={(event) => onChange(event.target.value)}
        />
        {field.unlimited ? (
          <label className="ceo-unlimited" htmlFor={`${id}-unlimited`}>
            <Checkbox
              id={`${id}-unlimited`}
              checked={numeric === String(UNLIMITED_LIMIT)}
              onCheckedChange={(checked) => onChange(checked ? String(UNLIMITED_LIMIT) : '0')}
            />
            Unlimited
          </label>
        ) : null}
      </div>
      {field.unlimited ? (
        <p className="ceo-muted">
          {numeric === String(UNLIMITED_LIMIT)
            ? 'Tanpa batas'
            : `Batas ${formatLimit(Number(numeric) || 0)}`}
        </p>
      ) : null}
      {error ? (
        <p className="ceo-field-error" role="alert">
          {error}
        </p>
      ) : null}
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
