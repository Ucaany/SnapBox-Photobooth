import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pelanggan' };

export default function CustomersPage() {
  return (
    <section className="owner-intro">
      <div>
        <p>Penjualan</p>
        <h1>Pelanggan</h1>
        <span>Data pelanggan belum tersedia.</span>
      </div>
    </section>
  );
}
