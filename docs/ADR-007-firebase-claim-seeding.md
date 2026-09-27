# ADR-007: Seeding Custom Claim Firebase dari Baris `users`

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-14.
Tanggal: 2026-09-27. Bukti: `AUDIT/14_R01_RUNTIME_BASELINE_2026-09-27.md` §3.

> **Ini menutup satu outage produksi yang sedang terjadi, bukan risiko
> hipotetis.** Lihat "Temuan runtime" di bawah.

## Konteks

Login `apps/web/src/lib/auth/authorization.ts:240-260` melakukan:

1. `verifyIdToken(idToken)`
2. `toCustomClaims(decoded)` — gagal berarti **`CLAIMS_INVALID`**
3. baca baris `users` dari DB
4. `claims.appRole !== user.role` berarti **`CLAIMS_STALE`**
5. gerbang subscription

`setUserClaims` (`packages/auth/src/admin.ts:105`) punya **tepat satu call
site** di seluruh repo: `staff/actions.ts:70`, yaitu pembuatan staff. Tidak
ada jalur yang menulis claim untuk OWNER atau CEO.

## Temuan runtime (2026-09-27, read-only)

Membandingkan custom claim Firebase dengan baris DB, untuk setiap user aktif
yang bukan placeholder `seed:`:

```
uid(8)        db_role   claim app_role   hasil
hVzGPzQZ      CEO       CEO              -> OK
Hrl14noH      OWNER     (missing)        -> CLAIMS_INVALID (login DITOLAK)

dapat login              = 1
ditolak CLAIMS_STALE     = 0
ditolak CLAIMS_INVALID   = 1
```

**Owner login adalah outage produksi sekarang.** Akun Owner yang ada tidak
bisa masuk. CEO bisa, karena claim-nya sudah ditanam manual di luar repo.

## Koreksi terhadap prediksi audit

Audit (`00` §9 item 6, `11` D-14) memperkirakan `CLAIMS_STALE`. Yang terjadi
sesungguhnya **`CLAIMS_INVALID`** — kode galat berbeda, karena claim-nya
**hilang**, bukan **tidak cocok**.

Hasilnya sama (login ditolak), mekanismenya berbeda, dan itu penting:
`CLAIMS_INVALID` muncul sebelum baris DB dibaca, sedangkan `CLAIMS_STALE`
muncul sesudahnya. Jadi dari log saja, orang tidak bisa membedakan "claim
belum ditanam" dari "claim sudah basi" — dua kondisi yang butuh tindakan
berbeda.

Hanya 2 dari 5 baris `users` yang punya UID Firebase asli; 3 sisanya
placeholder `seed:` dan memang tidak bisa login.

## Keputusan

1. **Seeding claim pindah ke skrip repo yang dimiliki dan idempoten:**
   `scripts/seed-firebase-claims.mjs`. Skrip ini membaca `public.users`,
   untuk setiap baris dengan `firebase_uid` valid dan tidak `disabled`,
   memanggil `buildCustomClaims` (`packages/auth/src/claims.ts:93`) lalu
   `setUserClaims`. Idempoten: aman dijalankan ulang.
2. **Skrip ini wajib berjalan di pipeline deploy**, setelah migrasi, sebelum
   server menerima traffic. Bukan langkah manual.
3. **`CLAIMS_STALE` dan `CLAIMS_INVALID` tetap hard failure.** Keduanya adalah
   properti keamanan yang benar. Yang diperbaiki adalah sumber datanya, bukan
   relaksasinya. Melembutkan check ini akan menyembunyikan claim yang basi.
4. **Baris `users` adalah satu sumber kebenaran.** Peran, `tenant_id`, dan
   `parent_tenant_id` claim selalu diturunkan dari DB. Tidak ada jalur yang
   menulis claim dari browser.
5. **Owner onboarding memanggil skrip atau fungsi yang sama, bukan
   `setUserClaims` inline.** Satu call site sudah menghasilkan bug ini; tidak
   boleh ada call site kedua yang lupa.

## Konsekuensi

- Menghapus satu-satunya penyebab outage Owner tanpa melemahkan auth.
- `CLAIMS_STALE` tidak lagi bisa dipicu oleh data yang repo tidak kendalikan.
- User harus login ulang untuk mendapat claim baru, karena
  `setCustomUserClaims` tidak mengubah token yang sudah terbit.
- Ini **tidak** menyiratkan role DB berubah. D-03 (ADR-006) adalah pekerjaan
  terpisah dan berisiko; jangan digabung.

## Yang harus diukur setelahnya

Satu login Owner nyata yang berhasil. Sampai itu terjadi, D-14 belum selesai
hanya karena skripnya ada.
