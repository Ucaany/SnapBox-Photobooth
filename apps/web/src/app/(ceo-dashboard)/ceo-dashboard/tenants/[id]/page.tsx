import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@snapbox/ui';

import {
  findTenantOwner,
  getTenantByIdOr404,
  listPlanOptions,
  listTenantActivity,
  listTenantBooths,
  listTenantSubscriptions,
  TenantServerError,
} from '@/lib/ceo-dashboard/tenant-server';

import { TenantDetailActions } from './tenant-detail-actions';

export const metadata: Metadata = {
  title: 'Detail tenant',
  robots: { index: false, follow: false },
};

/**
 * Halaman detail membaca DB dan berada di balik sesi CEO, jadi tidak boleh
 * dirender statis. Ini juga menjaga build tanpa kredensial DB runtime.
 */
export const dynamic = 'force-dynamic';

/**
 * `/ceo-dashboard/tenants/[id]` (PRD Task 1.4).
 *
 * Server component memuat profil, langganan, booth, dan audit NYATA dari DB.
 * Id yang tidak ada, terhapus, atau bukan UUID ditutup sebagai 404, bukan 403,
 * supaya keberadaan tenant tidak bocor lewat perbedaan respons (PRD Bab 5.5).
 *
 * Pemeriksaan UUID TIDAK diulang di sini: `getTenantByIdOr404` sudah menjadi
 * satu-satunya penjaga sehingga tidak ada dua regex yang bisa menyimpang.
 */
export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [tenant, owner, subscriptions, booths, activity, planOptions] = await Promise.all([
      getTenantByIdOr404(id),
      findTenantOwner(id),
      listTenantSubscriptions(id),
      listTenantBooths(id),
      listTenantActivity(id),
      listPlanOptions(),
    ]);

    const latestSubscription = subscriptions[0] ?? null;

    return (
      <div className="ceo-tenant-detail">
        <div className="ceo-intro">
          <div className="ceo-intro-text">
            <p className="ceo-kicker">
              <Link href="/ceo-dashboard/tenants">Tenant</Link> / Detail
            </p>
            <h1>{tenant.companyName}</h1>
            <p className="ceo-mono">{tenant.id}</p>
          </div>
          <div className="ceo-intro-actions">
            <Badge variant="neutral">{tenant.status}</Badge>
            <Badge variant="neutral">{tenant.planTier}</Badge>
          </div>
        </div>

        <div className="ceo-grid-2">
          <section className="ceo-panel">
            <h2>Profil</h2>
            <dl className="ceo-review-list">
              <Row label="Perusahaan" value={tenant.companyName} />
              <Row label="Email Owner" value={tenant.ownerEmail} />
              <Row label="Telepon" value={tenant.ownerPhone ?? 'Tidak diisi'} />
              <Row label="Alamat" value={tenant.address ?? 'Tidak diisi'} />
              <Row label="Dibuat" value={formatDateTime(tenant.createdAt)} />
              <Row label="Terakhir diperbarui" value={formatDateTime(tenant.updatedAt)} />
              <Row label="Catatan internal" value={tenant.notes ?? 'Tidak ada'} />
            </dl>
          </section>

          <section className="ceo-panel">
            <h2>Akun Owner</h2>
            {owner ? (
              <dl className="ceo-review-list">
                <Row label="Nama" value={owner.fullName} />
                <Row label="Email" value={owner.email} />
                <Row label="Status akun" value={owner.disabled ? 'Dinonaktifkan' : 'Aktif'} />
                <Row
                  label="Login terakhir"
                  value={owner.lastLoginAt ? formatDateTime(owner.lastLoginAt) : 'Belum pernah'}
                />
              </dl>
            ) : (
              <p className="ceo-muted">Belum ada akun Owner yang terhubung ke tenant ini.</p>
            )}
          </section>
        </div>

        <section className="ceo-panel">
          <h2>Kuota plan</h2>
          <dl className="ceo-quota-grid">
            <Quota label="Perangkat" value={tenant.deviceQuota} addon={tenant.addOnDevices} />
            <Quota label="Slot frame" value={tenant.frameQuota} />
            <Quota label="Penyimpanan (MB)" value={tenant.storageQuotaMb} />
            <Quota label="Akun staff" value={tenant.staffQuota} />
            <Quota label="Retensi (hari)" value={tenant.retentionDays} />
          </dl>
        </section>

        <section className="ceo-panel">
          <h2>Riwayat langganan</h2>
          {subscriptions.length === 0 ? (
            <p className="ceo-muted">Belum ada baris langganan.</p>
          ) : (
            <div className="ceo-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dibuat</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Nilai</th>
                    <th scope="col">Berlaku sampai</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.planTier}</td>
                      <td>{row.status}</td>
                      <td className="ceo-mono">{formatRupiah(row.amount)}</td>
                      <td>
                        {row.validUntil ? formatDateTime(row.validUntil) : 'Belum ditetapkan'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {latestSubscription?.status === 'PENDING' ? (
            <p className="ceo-muted">
              Status PENDING berarti pembayaran belum dikonfirmasi. Aktivasi hanya terjadi lewat
              webhook Pakasir terverifikasi, bukan dari dashboard.
            </p>
          ) : null}
        </section>

        <div className="ceo-grid-2">
          <section className="ceo-panel">
            <h2>Booth</h2>
            {booths.length === 0 ? (
              <p className="ceo-muted">Belum ada booth.</p>
            ) : (
              <ul className="ceo-plain-list">
                {booths.map((booth) => (
                  <li key={booth.id}>
                    <strong>{booth.name}</strong>
                    <span className="ceo-muted">
                      {booth.status}
                      {booth.locationTag ? ` / ${booth.locationTag}` : ''}
                      {booth.maintenanceMode ? ' / mode pemeliharaan' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ceo-panel">
            <h2>Aktivitas terbaru</h2>
            {activity.length === 0 ? (
              <p className="ceo-muted">Belum ada aktivitas tercatat untuk tenant ini.</p>
            ) : (
              <ul className="ceo-plain-list">
                {activity.map((entry) => (
                  <li key={entry.id}>
                    <strong className="ceo-mono">{entry.action}</strong>
                    <span className="ceo-muted">
                      {entry.actorEmail ?? 'Sistem'} / {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.reason ? (
                      <span className="ceo-muted">Alasan: {entry.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <TenantDetailActions
          tenantId={tenant.id}
          status={tenant.status}
          planTier={tenant.planTier}
          planOptions={planOptions}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof TenantServerError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ceo-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Quota({ label, value, addon = 0 }: { label: string; value: number; addon?: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="ceo-mono">
        {value < 0 ? 'Tanpa batas' : value}
        {addon > 0 ? ` + ${addon} add-on` : ''}
      </dd>
    </div>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(
    value,
  );
}

function formatRupiah(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}
