/**
 * Server action broadcast (PRD Task 1.9).
 *
 * Satu-satunya file `'use server'` untuk modul broadcast. Ia hanya mengekspor
 * async function sehingga memenuhi aturan Next; loader DB tetap di
 * `broadcast-server.ts` dan dipanggil server component secara langsung.
 */
'use server';

import { createBroadcast as createBroadcastImpl } from '@/lib/ceo-dashboard/broadcast-server';

export async function createBroadcast(input: unknown) {
  return createBroadcastImpl(input);
}
