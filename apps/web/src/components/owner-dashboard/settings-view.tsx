'use client';

import { useState, useTransition } from 'react';
import { updateOwnerProfile } from '@/app/(owner-dashboard)/owner-dashboard/settings/actions';

export function OwnerSettingsView({
  profile,
}: {
  profile: { fullName: string; phone: string | null; email: string };
}) {
  const [name, setName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    startTransition(async () =>
      setMessage(
        (await updateOwnerProfile({ fullName: name, phone }))
          ? 'Profil diperbarui.'
          : 'Profil gagal diperbarui. Periksa kembali input.',
      ),
    );
  }
  return (
    <section className="owner-section">
      <p className="owner-eyebrow">Akun</p>
      <h1>Pengaturan</h1>
      <form className="owner-form" onSubmit={save}>
        <label>
          Nama
          <input
            required
            minLength={2}
            maxLength={150}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Email
          <input value={profile.email} readOnly />
        </label>
        <label>
          Telepon
          <input
            maxLength={20}
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <button type="submit" disabled={pending}>
          Simpan profil
        </button>
        {message && <p role="status">{message}</p>}
      </form>
      <h2>Preferensi zona waktu</h2>
      <p>
        Zona waktu perangkat: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Preferensi ini
        belum disimpan.
      </p>
      <h2>Belum tersedia</h2>
      <ul>
        <li>Ubah kata sandi melalui pengaturan akun Firebase.</li>
        <li>Template email internal.</li>
        <li>API key perangkat.</li>
      </ul>
    </section>
  );
}
