'use client';

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@snapbox/ui';
import * as React from 'react';

import { CONTOH_TENANTS } from '../example-data';
import { PageIntro, Panel, StatusBadge } from '../panel';

/**
 * Broadcast (PRD Task 1.3).
 *
 * Form benar-benar tervalidasi: pesan wajib, minimal 12 karakter. Submit tidak
 * mengirim apa pun, hanya memberi umpan balik bahwa pengiriman realtime belum
 * aktif, sehingga tidak ada tombol yang diam-diam tidak melakukan apa pun.
 */
export function BroadcastView() {
  const [audience, setAudience] = React.useState('Semua tenant aktif');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<string | null>(null);

  const errorRef = React.useRef<HTMLParagraphElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (message.trim().length < 12) {
      setSent(null);
      setError('Pesan minimal 12 karakter sebelum bisa ditinjau.');
      return;
    }
    setError(null);
    setSent(
      `Pratinjau siap untuk ${audience}. Tidak ada notifikasi yang dikirim pada skeleton ini.`,
    );
  }

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <>
      <PageIntro
        title="Broadcast"
        description="Susun pengumuman untuk semua tenant atau tenant terpilih."
      >
        <StatusBadge tone="netral">Belum tersambung</StatusBadge>
      </PageIntro>

      <div className="ceo-grid-2">
        <Panel title="Susun pengumuman" description="Isi penerima dan isi pesan." example={false}>
          <form className="ceo-form" onSubmit={onSubmit} noValidate>
            <div className="ceo-field">
              <Label htmlFor="broadcast-audience">Penerima</Label>
              <Select value={audience} onValueChange={(value) => setAudience(value ?? '')}>
                <SelectTrigger id="broadcast-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua tenant aktif">Semua tenant aktif</SelectItem>
                  <SelectItem value="Tenant plan Growth">Tenant plan Growth</SelectItem>
                  <SelectItem value="Tenant plan Enterprise">Tenant plan Enterprise</SelectItem>
                  <SelectItem value="Tenant langganan tertunda">
                    Tenant langganan tertunda
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ceo-field">
              <Label htmlFor="broadcast-message">Isi pesan</Label>
              <Textarea
                id="broadcast-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                maxLength={280}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'broadcast-error' : 'broadcast-hint'}
                placeholder="Tulis pengumuman singkat untuk tenant."
              />
              {error ? (
                <p
                  id="broadcast-error"
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="ceo-error"
                >
                  {error}
                </p>
              ) : (
                <p id="broadcast-hint" className="ceo-hint">
                  {message.length}/280 karakter. Minimal 12 karakter.
                </p>
              )}
            </div>

            <Button type="submit">Pratinjau broadcast</Button>
          </form>

          {sent ? (
            <p className="ceo-feedback" role="status">
              {sent}
            </p>
          ) : null}
        </Panel>

        <Panel
          title="Jangkauan contoh"
          description="Perkiraan penerima berdasarkan pilihan saat ini."
          action={undefined}
        >
          <ul className="ceo-audience">
            {CONTOH_TENANTS.slice(0, 4).map((tenant) => (
              <li key={tenant.id}>
                <span className="ceo-cell-strong">{tenant.company}</span>
                <StatusBadge tone={tenant.status === 'Aktif' ? 'baik' : 'netral'}>
                  {tenant.plan}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <p className="ceo-hint">
            Daftar ini statis dan tidak menyesuaikan pilihan penerima. Pengiriman realtime
            dikerjakan pada fase notifikasi.
          </p>
        </Panel>
      </div>
    </>
  );
}
