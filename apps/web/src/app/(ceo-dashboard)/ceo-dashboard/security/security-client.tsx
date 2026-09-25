'use client';

import {
  Button,
  Input,
  NativeSelect,
  NativeSelectOption,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@snapbox/ui';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageIntro, Panel, StatusBadge } from '@/components/ceo-dashboard/panel';
import {
  SECURITY_EVENT_LABELS,
  SECURITY_SEVERITY_LABELS,
  SECURITY_WINDOW_HOURS,
  type SecurityEventRow,
  type SecurityEventType,
  type SecuritySeverity,
  type SecuritySnapshot,
} from '@/lib/ceo-dashboard/health-security-contract';

/**
 * Keamanan (PRD Task 1.11).
 *
 * Sumber: tabel `security_events` (login gagal, rate limit, WAF) dan
 * `auth_sessions` (sesi login web). Tidak ada data contoh dan tidak ada klaim
 * kepatuhan (R-17/R-36). Subjek ditampilkan sebagai fingerprint; IP mentah,
 * token, dan payload tidak pernah sampai ke halaman.
 */

const SEVERITY_TONES = {
  INFO: 'netral',
  WARNING: 'waspada',
  CRITICAL: 'bahaya',
} as const satisfies Record<SecuritySeverity, string>;

const EVENT_FILTERS = ['', 'LOGIN_FAILED', 'RATE_LIMIT_HIT', 'WAF_EVENT'] as const;

function severityTone(severity: SecuritySeverity) {
  return SEVERITY_TONES[severity];
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function windowLabel(hours: number): string {
  // Label diturunkan dari konstanta kontrak supaya filter dan teks tidak drift.
  const known = SECURITY_WINDOW_HOURS.find((value) => value === hours);
  if (known === 1) return '1 jam terakhir';
  if (known === 24) return '24 jam terakhir';
  if (known === 168) return '7 hari terakhir';
  if (known === 720) return '30 hari terakhir';
  return `${hours} jam terakhir`;
}

export function SecurityClient({ snapshot }: { snapshot: SecuritySnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [eventType, setEventType] = React.useState<'' | SecurityEventType>('');
  const [severity, setSeverity] = React.useState<'' | SecuritySeverity>('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);

  const PAGE_SIZE = 15;

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.events.filter((event) => {
      if (eventType && event.eventType !== eventType) return false;
      if (severity && event.severity !== severity) return false;
      if (needle) {
        const haystack =
          `${event.route ?? ''} ${event.source} ${event.requestId ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [snapshot.events, eventType, severity, query]);

  // Jemput kembali halaman bila filter baru membuat halaman aktif kosong.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const activeFilterCount = (eventType ? 1 : 0) + (severity ? 1 : 0) + (query.trim() ? 1 : 0);

  function resetFilters() {
    setEventType('');
    setSeverity('');
    setQuery('');
    setPage(0);
  }

  const { summary } = snapshot;

  return (
    <main className="space-y-6">
      <PageIntro
        title="Keamanan"
        description="Percobaan login gagal, rate limit, event WAF, dan sesi login aktif."
      >
        <Button
          type="button"
          variant="neutral"
          size="default"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? 'Memuat…' : 'Muat ulang'}
        </Button>
      </PageIntro>

      <section className="ceo-metrics" aria-label="Ringkasan sinyal keamanan">
        <div className="ceo-metric">
          <p className="ceo-metric-label">Login gagal</p>
          <p className="ceo-metric-value">{summary.loginFailed}</p>
          <p className="ceo-metric-foot">{windowLabel(summary.windowHours)}</p>
        </div>
        <div className="ceo-metric">
          <p className="ceo-metric-label">Rate limit tercapai</p>
          <p className="ceo-metric-value">{summary.rateLimitHit}</p>
          <p className="ceo-metric-foot">{windowLabel(summary.windowHours)}</p>
        </div>
        <div className="ceo-metric">
          <p className="ceo-metric-label">Event WAF</p>
          <p className="ceo-metric-value">{summary.wafEvent}</p>
          <p className="ceo-metric-foot">{windowLabel(summary.windowHours)}</p>
        </div>
        <div className="ceo-metric">
          <p className="ceo-metric-label">Sesi aktif</p>
          <p className="ceo-metric-value">{summary.activeSessions}</p>
          <p className="ceo-metric-foot">Login web, belum kedaluwarsa</p>
        </div>
      </section>

      {snapshot.unavailable.length > 0 ? (
        <ul className="ceo-policy">
          {snapshot.unavailable.map((note) => (
            <li key={note}>
              <StatusBadge tone="netral">Belum tersedia</StatusBadge>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Panel
        title="Event keamanan"
        description="Filter memakai data nyata pada jendela yang dipilih."
        example={false}
        action={
          <span className="ceo-table-count">
            {filtered.length} dari {snapshot.events.length} event
          </span>
        }
      >
        <div className="ceo-toolbar">
          <div className="ceo-field ceo-field-search">
            <label className="ceo-label" htmlFor="security-search">
              Cari event
            </label>
            <Input
              id="security-search"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Cari route atau id permintaan"
              autoComplete="off"
            />
          </div>

          <div className="ceo-field">
            <label className="ceo-label" htmlFor="security-type">
              Jenis
            </label>
            <NativeSelect
              id="security-type"
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value as '' | SecurityEventType);
                setPage(0);
              }}
            >
              {EVENT_FILTERS.map((value) => (
                <NativeSelectOption key={value || 'all'} value={value}>
                  {value === '' ? 'Semua jenis' : SECURITY_EVENT_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="ceo-field">
            <label className="ceo-label" htmlFor="security-severity">
              Tingkat
            </label>
            <NativeSelect
              id="security-severity"
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as '' | SecuritySeverity);
                setPage(0);
              }}
            >
              <NativeSelectOption value="">Semua tingkat</NativeSelectOption>
              {(['INFO', 'WARNING', 'CRITICAL'] as const).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {SECURITY_SEVERITY_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {activeFilterCount > 0 ? (
            <div className="ceo-toolbar-actions">
              <Button type="button" variant="noShadow" size="default" onClick={resetFilters}>
                Reset ({activeFilterCount})
              </Button>
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <p className="ceo-table-state" role="status">
            {snapshot.events.length === 0
              ? 'Belum ada event keamanan pada jendela ini.'
              : 'Tidak ada event yang cocok dengan filter.'}
          </p>
        ) : (
          <div className="ceo-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Waktu</TableHead>
                  <TableHead scope="col">Jenis</TableHead>
                  <TableHead scope="col">Tingkat</TableHead>
                  <TableHead scope="col">Route</TableHead>
                  <TableHead scope="col">Subjek</TableHead>
                  <TableHead scope="col">Sumber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((event: SecurityEventRow) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                    <TableCell className="ceo-cell-strong">{event.eventTypeLabel}</TableCell>
                    <TableCell>
                      <StatusBadge tone={severityTone(event.severity)}>
                        {event.severityLabel}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="ceo-mono">{event.route ?? '—'}</TableCell>
                    <TableCell className="ceo-mono">
                      {event.subjectFingerprint ? `fp:${event.subjectFingerprint}` : '—'}
                    </TableCell>
                    <TableCell className="ceo-mono">{event.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
          <div className="ceo-inline-actions">
            <Button
              type="button"
              variant="noShadow"
              size="default"
              disabled={safePage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Sebelumnya
            </Button>
            <span className="ceo-mono">
              Halaman {safePage + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="noShadow"
              size="default"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              Berikutnya
            </Button>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Sesi login web"
        description="Baris terbaru dari tabel auth_sessions; tidak memuat token."
        example={false}
      >
        {snapshot.sessions.length === 0 ? (
          <p className="ceo-table-state" role="status">
            Belum ada sesi login web yang tercatat.
          </p>
        ) : (
          <div className="ceo-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Peran</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">IP (hash)</TableHead>
                  <TableHead scope="col">Agen</TableHead>
                  <TableHead scope="col">Aktif Terakhir</TableHead>
                  <TableHead scope="col">Kedaluwarsa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="ceo-cell-strong">{session.role}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={
                          session.statusLabel === 'Aktif'
                            ? 'baik'
                            : session.statusLabel === 'Dicabut'
                              ? 'bahaya'
                              : 'netral'
                        }
                      >
                        {session.statusLabel}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="ceo-mono">
                      {session.ipHashPrefix ? `${session.ipHashPrefix}…` : '—'}
                    </TableCell>
                    <TableCell>{session.userAgent ?? '—'}</TableCell>
                    <TableCell>{formatDateTime(session.lastSeenAt)}</TableCell>
                    <TableCell>{formatDateTime(session.expiresAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <p className="ceo-footnote">
        Diambil {formatDateTime(snapshot.generatedAt)}. Rate limit aplikasi saat ini in-memory
        per-instance, sehingga angka di sini adalah sinyal yang teramati, bukan jaminan penegakan.
      </p>
    </main>
  );
}
