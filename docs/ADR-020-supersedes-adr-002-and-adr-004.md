# ADR-020: Men Suppersi ADR-002 dan ADR-004

## Status

Diterima. Tanggal: 2026-09-27.
Pemicu: `AUDIT/11_DECISIONS_REQUIRED.md` §"Recording an answer" — "`ADR-002`
dan `ADR-004` saat ini setengah benar dan basi masing-masing; failure mode-nya
kontradiksi di tempat, bukan supersesi."

## Kenapa ADR ini ada, dan kenapa tidak mengedit di tempat

Dua ADR lama tidak sekadar usang — keduanya **benar sampai batas tertentu**,
dan batas itu tidak tertulis di dalam dokumennya. Meneditnya di tempat
menghapus bukti tanggal bahwa batas itu pernah tidak disadari. Jadi keduanya
tidak diubah; mereka **supersi**, dan statusnya dicatat di bagian bawah.

### ADR-002 — sistem token neobrutalism

**Separuh benar.** Klaimnya bahwa palet repo adalah biru
(`--main: hsl(217, 100%, 66%)`) dan PRD Bab 4 basi **benar untuk dashboard**
Owner dan CEO. `ADR-005` (2026-09-26) sudahendentifikasi bahwa yang sama
tidak berlaku di permukaan marketing publik dan auth, yang masih
kuning/violet/pink PRD. `ADR-002` tidak pernah menyatakan itu, jadi ia
terbaca seolah berlaku seluruh repo.

**Sekarang:** sepenuhnya superseded oleh `ADR-005`. Palet biru, tanpa
gradient, adalah sumber kebenaran repo. `ADR-011` (UI primitives) dan
`ADR-012` (dark mode) turun dari situ.

### ADR-004 — cookie sesi bertanda tangan dan batas middleware edge

**Basi dan sekarang berbahaya kalau dibaca sendiri.** `ADR-004` menyelesaikan
ketegangan nyata (middleware edge tidak bisa menjalankan `firebase-admin`).
Solusinya benar. Yang tidak tercatat: keputusan itu membuat verifikasi
sesi **murni kriptografis** — HMAC plus kedaluwarsa — dan itu tetap berlaku.

Runtime pass 2026-09-27 mengonfirmasi konsekuensinya secara langsung:

```
verifySession() sebelum revocation -> VALID
verifySession() sesudah revocation -> MASIH VALID
signature dipalsukan                 -> null  (HMAC menolak, kripto-nya benar)
verifySession() menyentuh DB?        -> false
`revokedAt` dibaca di jalur ini?     -> tidak
```

Jadi `auth_sessions.revoked_at` ditulis (`health-security-server.ts:294,314`)
dan **tidak pernah dibaca** oleh jalur verifikasi. Cookie yang dicabut tetap
sah selama 12 jam penuh. Peranpun melekat di dalam cookie, jadi menurunkan
peran di DB tidak mengubah cookie yang sudah terbit — yang sesudahnya
`/ceo-dashboard/tenants/[id]` bersandar pada nilai cookie itu saja.

**Konsekuensi untuk ADR-004:** batas yang ia gambarkan itu nyata, dan ia
sumber dari atrapnya adalah batas **runtime**, bukan hanya bahasa. Edge
runtime adalah satu-satunya alasan `verifyIdToken` tidak bisa dipanggil
per-request, dan itulah alasan revocation tidak ditegakkan.

## Keputusan

1. `ADR-002` dan `ADR-004` **statusnya diubah menjadi "Superseded"** di
   respective files, dengan pointer ke ADR ini. Isi keduanya tidak
   dihapus.
2. Revocation harus ditegakkan. `verifySession` tidak dapat tetap murni
   kriptografis tanpa konsekuensi yang diukur di atas.
3. Batas edge runtime **tidak boleh hilang dari dokumentasi** saat revocation
   diperbaiki. Kalau `verifyIdToken` dipindah ke Node runtime untuk
   menegakkan revocation, biaya cold-start itu harus dicatat, dan
   `ADR-004` di-regioning.

## Urutan yang diwajibkan

`revokedAt` harus mulai dibaca **setelah**tests yang ada tetap hijau, dan
penyemianan cookie harus konsisten dengan `releaseMarker`.
