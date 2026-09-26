import Link from 'next/link';
import type { OutletDetail } from '@/lib/owner-dashboard/outlet-contract';
export function OutletDetailView({ outlet }: { outlet: OutletDetail }) {
  return (
    <div className="space-y-8">
      <Link className="underline" href="/owner-dashboard/outlets">
        Kembali ke outlet
      </Link>
      <header>
        <p className="text-muted-foreground text-sm tracking-[0.18em] uppercase">Detail outlet</p>
        <h1 className="text-3xl font-bold">{outlet.name}</h1>
        <p>
          {outlet.isActive ? 'Aktif' : 'Nonaktif'} · dibuat{' '}
          {new Date(outlet.createdAt).toLocaleDateString('id-ID')}
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="border-2 border-foreground p-4">
          <h2 className="font-bold">Profil</h2>
          <p>{outlet.address || 'Alamat belum diisi'}</p>
          <p>
            {outlet.picName || 'PIC belum diisi'} {outlet.picPhone ? `· ${outlet.picPhone}` : ''}
          </p>
          <p>
            {outlet.latitude && outlet.longitude
              ? `${outlet.latitude}, ${outlet.longitude}`
              : 'Koordinat belum diisi'}
          </p>
        </div>
        <div className="border-2 border-foreground p-4">
          <h2 className="font-bold">Penjualan</h2>
          <p>{outlet.sales.transactionCount} transaksi lunas</p>
          <p className="text-2xl font-bold">
            Rp {Number(outlet.sales.total).toLocaleString('id-ID')}
          </p>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Booth terhubung</h2>
        {outlet.booths.length === 0 ? (
          <p className="border-2 border-dashed p-6">Belum ada booth terhubung.</p>
        ) : (
          <div className="overflow-x-auto border-2 border-foreground">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Lokasi</th>
                </tr>
              </thead>
              <tbody>
                {outlet.booths.map((booth) => (
                  <tr key={booth.id} className="border-t-2 border-foreground">
                    <td className="p-3">{booth.name}</td>
                    <td className="p-3">{booth.status}</td>
                    <td className="p-3">{booth.locationTag || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
