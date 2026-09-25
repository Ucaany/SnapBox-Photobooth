'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from '@snapbox/ui';
import * as React from 'react';

import { CONTOH_ALERTS, CONTOH_GROWTH, CONTOH_METRICS } from '../example-data';
import { DataBadge, PageIntro, Panel, StatusBadge, toneForStatus, TrendTag } from '../panel';

/**
 * Dashboard utama CEO (PRD Task 1.3).
 *
 * Fokus layar: deretan metric tile, lalu panel pertumbuhan dan alert sistem.
 * Grafik digambar sebagai batang CSS sederhana, bukan Recharts, supaya skeleton
 * tetap ringan dan tidak menyiratkan data nyata.
 */
export function DashboardView() {
  const [showAlerts, setShowAlerts] = React.useState<'semua' | 'tinggi'>('semua');

  const alerts = React.useMemo(
    () =>
      showAlerts === 'tinggi'
        ? CONTOH_ALERTS.filter((alert) => alert.severity === 'Tinggi')
        : CONTOH_ALERTS,
    [showAlerts],
  );

  return (
    <>
      <PageIntro
        title="Ringkasan platform"
        description="Metrik lintas tenant, pertumbuhan langganan, dan alert sistem dalam satu layar."
      >
        <StatusBadge tone="info">Fase 1</StatusBadge>
      </PageIntro>

      <section className="ceo-metrics" aria-label="Metrik contoh">
        {CONTOH_METRICS.map((metric) => (
          <Card key={metric.id} className="ceo-metric">
            <CardHeader>
              <CardTitle className="ceo-metric-label">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="ceo-metric-value">
                {metric.value}
                {metric.unit ? <span>{metric.unit}</span> : null}
              </p>
              <div className="ceo-metric-foot">
                <TrendTag trend={metric.trend}>{metric.delta}</TrendTag>
              </div>
              <p className="ceo-metric-hint">{metric.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="ceo-grid-2">
        <Panel
          title="Pertumbuhan 6 bulan"
          description="Jumlah tenant dan langganan berbayar, skala relatif."
          action={
            <div className="ceo-legend" aria-hidden>
              <span className="ceo-legend-item">
                <span className="ceo-legend-swatch ceo-legend-tenant" /> Tenant
              </span>
              <span className="ceo-legend-item">
                <span className="ceo-legend-swatch ceo-legend-sub" /> Langganan
              </span>
            </div>
          }
        >
          <div
            className="ceo-chart"
            role="img"
            aria-label="Grafik batang pertumbuhan tenant dan langganan enam bulan terakhir, data contoh"
          >
            {CONTOH_GROWTH.map((point) => (
              <div className="ceo-chart-group" key={point.bulan}>
                <div className="ceo-chart-bars">
                  <span
                    className="ceo-chart-bar ceo-bar-tenant"
                    style={{ height: `${point.tenant}%` }}
                    title={`Tenant ${point.bulan}: ${point.tenant}`}
                  />
                  <span
                    className="ceo-chart-bar ceo-bar-sub"
                    style={{ height: `${point.langganan}%` }}
                    title={`Langganan ${point.bulan}: ${point.langganan}`}
                  />
                </div>
                <span className="ceo-chart-label">{point.bulan}</span>
              </div>
            ))}
          </div>
          <p className="ceo-chart-scale">
            Skala vertikal mewakili nilai relatif 0 sampai 128. Nilai contoh.
          </p>
        </Panel>

        <Panel
          title="Alert sistem"
          description="Tiga contoh kondisi yang butuh perhatian."
          action={
            <div className="ceo-segment" role="group" aria-label="Saring alert berdasarkan tingkat">
              <button
                type="button"
                aria-pressed={showAlerts === 'semua'}
                onClick={() => setShowAlerts('semua')}
              >
                Semua
              </button>
              <button
                type="button"
                aria-pressed={showAlerts === 'tinggi'}
                onClick={() => setShowAlerts('tinggi')}
              >
                Tinggi saja
              </button>
            </div>
          }
        >
          {alerts.length === 0 ? (
            <p className="ceo-muted">Tidak ada alert tingkat tinggi pada data contoh.</p>
          ) : (
            <ul className="ceo-alert-list">
              {alerts.map((alert) => (
                <li key={alert.id} className="ceo-alert">
                  <span className="ceo-alert-icon" aria-hidden>
                    {alert.severity === 'Rendah' ? <InfoGlyph /> : <AlertGlyph />}
                  </span>
                  <div>
                    <p className="ceo-alert-title">
                      {alert.title}
                      <StatusBadge tone={toneForStatus(alert.severity)}>
                        {alert.severity}
                      </StatusBadge>
                    </p>
                    <p className="ceo-alert-detail">{alert.detail}</p>
                    <p className="ceo-alert-at">{alert.at}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Kesiapan modul"
        description="Status fungsional skeleton per area. Bukan indikator kesiapan produksi."
      >
        <ul className="ceo-readiness">
          {[
            { label: 'Navigasi dan layout', value: 100, note: 'Selesai di Task 1.3' },
            { label: 'Data tenant produksi', value: 0, note: 'Task 1.4' },
            { label: 'Editor harga dan fitur', value: 0, note: 'Task 1.5' },
            { label: 'Engine langganan B2B', value: 0, note: 'Task 1.6' },
          ].map((row) => (
            <li key={row.label}>
              <div className="ceo-readiness-head">
                <span>{row.label}</span>
                <span className="ceo-mono">{row.value}%</span>
              </div>
              <Progress value={row.value} aria-label={`${row.label}: ${row.value} persen`} />
              <p className="ceo-readiness-note">{row.note}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Ringkasan perangkat contoh"
        description="Tiga perangkat dengan heartbeat terbaru."
        action={<DataBadge />}
      >
        <div className="ceo-mini-grid">
          {['SBX-0142', 'SBX-0143', 'SBX-0207'].map((device, index) => (
            <Card key={device} className="ceo-mini-card">
              <CardContent>
                <CameraGlyph />
                <p className="ceo-mono">{device}</p>
                <Badge variant="neutral">{index === 2 ? 'Idle' : 'Online'}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </Panel>
    </>
  );
}

/**
 * Glyph digambar inline, bukan dari `lucide-react` (dependency `@snapbox/ui`,
 * bukan `apps/web`). Semua dekoratif dan selalu disertai teks/label.
 */
function AlertGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function CameraGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
