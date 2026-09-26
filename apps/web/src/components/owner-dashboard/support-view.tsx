'use client';

import { useState, useTransition } from 'react';
import { submitOwnerSupport } from '@/app/(owner-dashboard)/owner-dashboard/support/actions';

export function OwnerSupportView() {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    setMessage('');
    startTransition(async () => {
      const category = data.get('category');
      const result = await submitOwnerSupport({
        category: category === 'technical' ? 'technical' : category,
        subject: data.get('subject'),
        message: data.get('message'),
      });
      setMessage(result.message);
      if (result.ok) form.reset();
    });
  }
  return (
    <section className="owner-section">
      <p className="owner-eyebrow">Akun</p>
      <h1>Dukungan</h1>
      <p>Pesan dikirim melalui email. Formulir ini tidak membuat tiket.</p>
      <form className="owner-form" onSubmit={submit}>
        <label>
          Kategori
          <select name="category">
            <option value="account">Akun</option>
            <option value="billing">Tagihan</option>
            <option value="technical">Teknis</option>
            <option value="other">Lainnya</option>
          </select>
        </label>
        <label>
          Subjek
          <input name="subject" required minLength={3} maxLength={150} />
        </label>
        <label>
          Pesan
          <textarea name="message" required minLength={10} maxLength={5000} rows={7} />
        </label>
        <button type="submit" disabled={pending}>
          Kirim pesan
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
