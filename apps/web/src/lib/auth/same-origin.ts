/**
 * Pemeriksaan same-origin untuk route yang menerbitkan cookie sesi.
 *
 * Kenapa endpoint penerbit cookie wajib memeriksanya, dan kenapa `SameSite=Lax`
 * tidak cukup: `Lax` hanya menahan cookie pada navigasi tingkat atas yang
 * METODE-nya aman. Navigasi tingkat atas dengan POST — termasuk yang dilakukan
 * `<form>` dari situs lain — tetap membawa cookie. Karena cookie sesi dipasang
 * dari RESPON, penyerang yang memicu POST lintas situs bisa mengikat cookie
 * korban ke ID token milik penyerang (login CSRF).
 *
 * Modul ini tidak sengaja memakai `server-only`: ia dipanggil dari route handler
 * biasa, bukan dari server action, dan tidak menarik apa pun.
 */

/**
 * `true` bila permintaan dianggap berasal dari origin sendiri.
 *
 * Klien non-browser (curl, server-to-server, test) mengirim tanpa header `Origin`
 * dan tidak mungkin menjadi sasaran CSRF, jadi ketiadaan header diizinkan.
 * Bila header ADA, `origin`-nya wajib PERSIS sama dengan origin `request.url` —
 * skema, host, dan port. Perbandingan `origin` penuh (bukan hanya `host`)
 * dipilih karena `Origin` memang selalu diserialkan sebagai `scheme://host:port`,
 * jadi tidak ada informasi yang hilang; membandingkan `host` saja justru
 * mengizinkan POST `http://` menuju origin `https://`.
 *
 * `Origin: null` (sandbox, `file://`, beberapa ekstensi) otomatis gagal karena
 * `new URL('null')` melempar.
 *
 * Header `Referer` sengaja tidak dipakai sebagai cadangan: ia mudah dihapus dan
 * tidak ada yang memaksa klien mengirimnya.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
