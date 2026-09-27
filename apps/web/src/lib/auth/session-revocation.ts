/**
 * Penegakan pencabutan sesi web (P-B-01, ADR-004).
 *
 * `verifySession` sengaja TIDAK menyentuh DB: ia jalan di Edge runtime, dan
 * Edge tidak bisa membuka koneksi PostgreSQL. Yang melakukan pembacaan
 * `auth_sessions.revoked_at` adalah gate Node `requireCeo()` dan
 * `requireOwnerTenant()`, yang memang sudah menanyakan `users` — jadi satu
 * query tambahan, bukan lapisan baru.
 *
 * KENAPA DI SINI DAN BUKAN DI `verifySession`. Middleware Edge membaca snapshot
 * cookie hanya untuk redirect awal. Setiap halaman privat dan server action
 * sudah melewati gate Node, jadi satu-satunya tempat yang perlu diperkuat adalah
 * gate itu. Meletakkan pencabutan di middleware justru akan menambah query DB
 * ke runtime yang secara desain tidak boleh melakukannya.
 *
 * KEBIJAKAN "BARIS TIDAK ADA = TIDAK DICABUT". `auth_sessions` tidak pernah
 * dihapus: satu-satunya penulisnya adalah `recordAuthSession` (insert),
 * `revokeAuthSession` dan `revokeAuthSessionsForUser` (set `revoked_at`). Jadi
 * baris yang tidak ada berarti "pencatatan telemetri gagal", bukan "pencabutan
 * dihapus". Menolak di kasus itu akan mengunci pengguna yang login-nya sah
 * setiap kali insert telemetri gagal — kegagalan yang jauh lebih sering dan
 * lebih merusak daripada yang dicegah. Sesi yang benar-benar dicabut selalu
 * ditemukan, karena `revoke*` sudah menulis barisnya.
 */
import 'server-only';

import { eq } from 'drizzle-orm';

import { authSessions, getDatabase } from '@snapbox/db';

/**
 * `true` bila sesi sudah dicabut, jadi cookie-nya tidak boleh lagi
 * mengautentikasi.
 *
 * Kegagalan DB TIDAK ditelan: `getDatabase()`/query yang melempar berarti
 * `revokedAt` tidak bisa dipastikan, dan gate harus gagal tertutup. Errornya
 * diteruskan ke pemanggil, yang sudah gagal tertutup juga.
 */
export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  const [row] = await getDatabase()
    .select({ revokedAt: authSessions.revokedAt })
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  return row?.revokedAt != null;
}
