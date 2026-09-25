'use client';

import { Button, Input, Label, Textarea } from '@snapbox/ui';
import * as React from 'react';

import {
  broadcastInputSchema,
  collectBroadcastIssues,
  type BroadcastHistoryRow,
  type BroadcastTenantOption,
} from '@/lib/ceo-dashboard/broadcast-contract';

import { createBroadcast } from '@/app/(ceo-dashboard)/ceo-dashboard/broadcast/actions';

import { PageIntro, Panel, StatusBadge } from '../panel';

type Audience = 'all' | 'selected';

interface BroadcastProps {
  readonly tenants?: readonly BroadcastTenantOption[];
  readonly history?: readonly BroadcastHistoryRow[];
}

/**
 * Broadcast (PRD Task 1.9).
 *
 * Form mengirim ke server action `createBroadcast`: penerima divalidasi ulang
 * di server (target `all` hanya tenant aktif; tenant terpilih yang suspend/ban
 * ditolak). Validasi browser memakai skema kontrak yang SAMA, sehingga pesan
 * error klien dan server tidak bisa menyimpang.
 */
export function BroadcastView({ tenants = [], history = [] }: BroadcastProps) {
  const [title, setTitle] = React.useState('');
  const [audience, setAudience] = React.useState<Audience>('all');
  const [selected, setSelected] = React.useState<readonly string[]>([]);
  const [message, setMessage] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [feedback, setFeedback] = React.useState<{ tone: 'ok' | 'error'; message: string } | null>(
    null,
  );
  const [pending, setPending] = React.useState(false);

  const errorRef = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (feedback?.tone === 'error') errorRef.current?.focus();
  }, [feedback]);

  /** Perkiraan penerima untuk pilihan saat ini, dihitung dari data server. */
  const estimatedRecipients = React.useMemo(() => {
    if (audience === 'all')
      return tenants.reduce((total, tenant) => total + tenant.recipientCount, 0);
    return tenants
      .filter((tenant) => selected.includes(tenant.id))
      .reduce((total, tenant) => total + tenant.recipientCount, 0);
  }, [audience, selected, tenants]);

  const selectedNames = React.useMemo(
    () =>
      tenants.filter((tenant) => selected.includes(tenant.id)).map((tenant) => tenant.companyName),
    [selected, tenants],
  );

  function toggleTenant(id: string, checked: boolean) {
    setSelected((ids) => (checked ? [...ids, id] : ids.filter((item) => item !== id)));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const payload =
      audience === 'all'
        ? { title, message, targetAll: true as const }
        : { title, message, targetAll: false as const, tenantIds: [...selected] };

    const parsed = broadcastInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(collectBroadcastIssues(parsed.error.issues));
      setFeedback({ tone: 'error', message: 'Periksa kembali data broadcast.' });
      return;
    }

    setPending(true);
    setErrors({});
    setFeedback(null);

    try {
      const result = await createBroadcast(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFeedback({ tone: 'error', message: result.message });
        return;
      }
      setFeedback({
        tone: 'ok',
        message: `${result.message} ${result.recipientCount} penerima di ${result.targetTenantCount ?? 0} tenant.`,
      });
      setTitle('');
      setMessage('');
      setSelected([]);
    } catch {
      setFeedback({
        tone: 'error',
        message: 'Pengiriman gagal karena gangguan koneksi. Coba lagi.',
      });
    } finally {
      setPending(false);
    }
  }

  const hasTenants = tenants.length > 0;

  return (
    <>
      <PageIntro
        title="Broadcast"
        description="Susun pengumuman untuk semua tenant atau tenant terpilih."
      >
        <StatusBadge tone="baik">Terhubung</StatusBadge>
      </PageIntro>

      <div className="ceo-grid-2">
        <Panel
          title="Susun pengumuman"
          description="Isi penerima, judul, dan isi pesan."
          example={false}
        >
          <form className="ceo-form" onSubmit={onSubmit} noValidate>
            <div className="ceo-field">
              <Label htmlFor="broadcast-title">Judul</Label>
              <Input
                id="broadcast-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'broadcast-title-error' : undefined}
                required
              />
              {errors.title ? (
                <p id="broadcast-title-error" className="ceo-error" role="alert">
                  {errors.title}
                </p>
              ) : null}
            </div>

            <div className="ceo-field">
              <Label htmlFor="broadcast-audience">Penerima</Label>
              <select
                id="broadcast-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value as Audience)}
                className="h-11 border-2 border-border bg-background px-3"
              >
                <option value="all">Semua tenant aktif</option>
                <option value="selected">Tenant terpilih</option>
              </select>
            </div>

            {audience === 'selected' ? (
              <div className="ceo-field">
                <span className="ceo-feature-label">Tenant penerima</span>
                {hasTenants ? (
                  <div className="ceo-checkbox-group" role="group" aria-label="Tenant penerima">
                    {tenants.map((tenant) => (
                      <label
                        key={tenant.id}
                        className="ceo-checkbox"
                        htmlFor={`broadcast-${tenant.id}`}
                      >
                        <input
                          id={`broadcast-${tenant.id}`}
                          type="checkbox"
                          checked={selected.includes(tenant.id)}
                          onChange={(event) => toggleTenant(tenant.id, event.target.checked)}
                        />
                        {tenant.companyName} ({tenant.recipientCount})
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="ceo-hint">Belum ada tenant aktif.</p>
                )}
                {errors.target || errors.tenantIds ? (
                  <p className="ceo-error" role="alert">
                    {errors.target ?? errors.tenantIds}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="ceo-field">
              <Label htmlFor="broadcast-message">Isi pesan</Label>
              <Textarea
                id="broadcast-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={280}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'broadcast-message-error' : 'broadcast-hint'}
                placeholder="Tulis pengumuman singkat untuk tenant."
              />
              {errors.message ? (
                <p id="broadcast-message-error" className="ceo-error" role="alert">
                  {errors.message}
                </p>
              ) : (
                <p id="broadcast-hint" className="ceo-hint">
                  {message.length}/280 karakter. Minimal 12 karakter.
                </p>
              )}
            </div>

            <p className="ceo-hint" aria-live="polite">
              Perkiraan penerima: {estimatedRecipients}
              {audience === 'selected' && selectedNames.length > 0
                ? ` (${selectedNames.slice(0, 3).join(', ')}${selectedNames.length > 3 ? ', …' : ''})`
                : ''}
            </p>

            {feedback ? (
              <p
                ref={errorRef}
                tabIndex={feedback.tone === 'error' ? -1 : undefined}
                className={
                  feedback.tone === 'ok' ? 'ceo-feedback' : 'ceo-feedback ceo-feedback-error'
                }
                role={feedback.tone === 'ok' ? 'status' : 'alert'}
              >
                {feedback.message}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={
                pending || !hasTenants || (audience === 'selected' && selected.length === 0)
              }
            >
              {pending ? 'Mengirim...' : 'Kirim broadcast'}
            </Button>
          </form>
        </Panel>

        <Panel
          title="Riwayat broadcast"
          description="Sumber data tersimpan dari pengiriman sebelumnya."
          example={false}
        >
          {history.length === 0 ? (
            <p className="ceo-hint">Belum ada broadcast terkirim.</p>
          ) : (
            <ul className="ceo-audience">
              {history.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <span className="ceo-cell-strong">{row.title}</span>
                  <StatusBadge tone="netral">
                    {row.targetAll ? 'Semua tenant' : `${row.targetCount} tenant`} ·{' '}
                    {row.recipientCount} penerima
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
          <p className="ceo-hint">
            Tenant aktif tanpa Owner/Staff aktif tidak menerima notifikasi. Riwayat menampilkan
            waktu dalam UTC.
          </p>
        </Panel>
      </div>
    </>
  );
}
