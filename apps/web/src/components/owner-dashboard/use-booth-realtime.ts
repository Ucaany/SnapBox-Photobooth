'use client';
/**
 * Langganan Supabase Realtime kanal `booth:{id}` untuk daftar mesin
 * (PRD Bab 6.B + 7.1). Tujuannya HANYA memicu rekonsiliasi ke sumber
 * kebenaran server; status tidak pernah dihitung dari payload realtime.
 *
 * Transport: WebSocket Phoenix (Supabase Realtime) memakai anon key publik —
 * service role TIDAK PERNAH dipakai di browser. Bila koneksi gagal/tertutup,
 * UI tetap menampilkan snapshot server dan menandainya usang.
 */
import { useEffect, useRef, useState } from 'react';

export interface BoothRealtimeStatus {
  readonly connected: boolean;
  /** Bertambah setiap event booth diterima; dipakai efek untuk refetch. */
  readonly tick: number;
}

const normalize = (url: string) => url.replace(/\/+$/, '');

export function useBoothRealtime(boothIds: readonly string[]): BoothRealtimeStatus {
  const [status, setStatus] = useState<BoothRealtimeStatus>({ connected: false, tick: 0 });
  const idsRef = useRef(boothIds);
  idsRef.current = boothIds;
  // Kunci stabil: id booth di-join agar efek hanya restart saat himpunan berubah.
  const idsKey = boothIds.join('|');

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || boothIds.length === 0) return;

    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let joined = false;
    let closed = false;
    let ref = 0;

    const send = (payload: Record<string, unknown>) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    };

    const join = (topic: string) => {
      ref += 1;
      send({
        topic,
        event: 'phx_join',
        payload: { config: { broadcast: { self: false }, presence: { key: '' } } },
        ref: String(ref),
      });
    };

    const connect = () => {
      socket = new WebSocket(
        `${normalize(url).replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`,
      );

      socket.onopen = () => {
        for (const id of idsRef.current) join(`booth:${id}`);
      };

      socket.onmessage = (event) => {
        let message: { event?: string; topic?: string; ref?: string | null };
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.event === 'phx_reply' && message.topic && message.ref) {
          joined = true;
          setStatus((current) => ({ ...current, connected: true }));
          return;
        }
        if (
          message.event === 'broadcast' ||
          (message.topic?.startsWith('booth:') && message.event !== 'phx_reply')
        ) {
          setStatus((current) => ({ ...current, tick: current.tick + 1 }));
        }
      };

      socket.onerror = () => {
        setStatus((current) => ({ ...current, connected: false }));
      };

      socket.onclose = () => {
        joined = false;
        setStatus((current) => ({ ...current, connected: false }));
        if (!closed) reconnect = setTimeout(connect, 5_000);
      };

      heartbeat = setInterval(() => {
        send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String((ref += 1)) });
      }, 25_000);
    };

    connect();

    return () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (reconnect) clearTimeout(reconnect);
      if (socket && joined) {
        for (const id of idsRef.current) {
          send({ topic: `booth:${id}`, event: 'phx_leave', payload: {}, ref: String((ref += 1)) });
        }
      }
      socket?.close();
      setStatus({ connected: false, tick: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey menggantikan boothIds; idsRef dibaca sebagai nilai terbaru
  }, [idsKey]);

  return status;
}
