'use client';

import { useState, useTransition } from 'react';
import { markOwnerNotificationRead } from '@/app/(owner-dashboard)/owner-dashboard/notifications/actions';

type Notification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function OwnerNotificationsView({ items }: { items: Notification[] }) {
  const [rows, setRows] = useState(items);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const unread = rows.filter((item) => !item.isRead).length;
  function markRead(id: string) {
    startTransition(async () => {
      const result = await markOwnerNotificationRead(id);
      setMessage(
        result ? 'Notifikasi ditandai sudah dibaca.' : 'Status notifikasi gagal diperbarui.',
      );
      if (result)
        setRows((current) =>
          current.map((row) => (row.id === id ? { ...row, isRead: true } : row)),
        );
    });
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-muted-foreground text-sm font-medium tracking-[0.18em] uppercase">
          Akun
        </p>
        <h1 className="text-3xl font-bold">Notifikasi</h1>
        <p className="text-muted-foreground">
          Riwayat pemberitahuan 30 hari terakhir · {unread} belum dibaca.
        </p>
      </header>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {rows.length === 0 ? (
        <p className="border-2 border-dashed p-6">Belum ada notifikasi baru.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <article
              key={item.id}
              className={`border-2 border-foreground p-4 ${item.isRead ? 'bg-background' : 'bg-yellow-100'} shadow-[4px_4px_0_0_currentColor]`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-wide uppercase">
                    {item.severity} · {item.type.replaceAll('_', ' ')}
                  </p>
                  <h2 className="text-lg font-bold">{item.title}</h2>
                </div>
                <time className="text-sm" dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.createdAt))}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{item.message}</p>
              {!item.isRead && (
                <button
                  disabled={pending}
                  onClick={() => markRead(item.id)}
                  className="mt-3 min-h-11 border-2 border-foreground px-3 font-semibold"
                >
                  Tandai dibaca
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
