# ADR-006: Peran Database Runtime Non-Owner, dan RLS yang Dipaksa

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-03.
Tanggal: 2026-09-27. Bukti: `AUDIT/14_R01_RUNTIME_BASELINE_2026-09-27.md` §2.

## Konteks

Semua traffic aplikasi melewati `packages/db/src/client.ts:30-56` yang
menghubungkan `postgres(DATABASE_URL)` secara langsung. RLS `ENABLE` di 35
tabel, tidak satu pun `FORCE`.

Audit static (`05` BE-001) memprediksi: aplikasi connect sebagai **owner**,
jadi RLS dilewati. Prediksi itu **benar, tetapi tidak lengkap**, dan runtime
pass membuktikan bentuk yang sebenarnya lebih buruk dari yang tertulis di
audit.

## Bukti runtime (2026-09-27)

Koneksi `DATABASE_URL` merender ke
`aws-0-ap-southeast-2.pooler.supabase.com:6543` (transaction pooler) sebagai:

```
current_user  = postgres
rolsuper      = false
rolbypassrls  = true          <-- BUKAN sekadar owner
```

Pemeriksaan 35 tabel `public`:

```
rls_enabled, NOT forced  = 35
...of which app is OWNER = 35
rls_forced               = 0
```

Uji silang, satu transaksi, klaim tenant A sama, **tanpa predikat tenant**:

| Peran koneksi         | Booth yang terlihat           |
| --------------------- | ----------------------------- |
| `postgres` (aplikasi) | **4 — seluruh tenant**        |
| `authenticated`       | 1 — hanya tenant yang diklaim |

Jadi policy-nya **benar dan berjalan**; yang salah adalah perannya. Ini
membuktikan bahwa cacat ada di role, bukan di teks policy.

## Koreksi penting terhadap D-03

D-03 option A berbunyi "buat role non-owner, lalu `FORCE RLS`". Data runtime
menambahkan syarat yang tidak ada di audit: `postgres` memegang atribut
**`BYPASSRLS`**. Role `BYPASSRLS` melewati RLS **meski** `FORCE ROW LEVEL
SECURITY` di-set. `FORCE` hanya menundukkan _owner_; ia tidak menundukkan
role yang memegang `BYPASSRLS`.

Artinya: **`FORCE RLS` saja tidak akan memperbaiki apa pun untuk kredensial
sekarang.** Itu sebabnya pemeriksaan "apakah policy berjalan" harus diulang
setelah role diganti. Kalau tidak, tim akan mengaktifkan `FORCE`, melihat
policy masih tidak berjalan, dan menyimpulkan audit salah.

## Keputusan

1. **`DATABASE_URL` dalam aplikasi memakai role DML non-owner, non-`BYPASSRLS`**
   dengan hanya `SELECT/INSERT/UPDATE/DELETE` pada `public` (plus `USAGE` pada
   schema). Role itu **tidak** memegang `BYPASSRLS` dan **bukan** owner tabel
   mana pun.
2. **Role owner hanya untuk migrasi** (`migrate:ordered`, seed), lewat
   `DIRECT_URL` yang sudah ada di env. Ini mempertahankan jalur Drizzle.
3. **`FORCE ROW LEVEL SECURITY` diaktifkan setelah langkah 1 terverifikasi**,
   tidak sebelumnya. Mengaktifkannya lebih dulu akan menolak jalur
   migrasi/seed, karena keduanya juga connect sebagai owner.
4. **Urutan wajib, tanpa pintasan:**
   ```
   buat role DML  ->  cabut BYPASSRLS  ->  UJI policy memblokir lintas-tenant
                 ->  baru FORCE RLS     ->  UJI ULANG
   ```
5. **Gating deploy:** release check wajib menjalankan uji lintas-tenant
   (dua tenant, satu sesi) sebagai role aplikasi. Melewati gate = jangan
   deploy.

## Konsekuensi

- PRD §5.5 "RLS sebagai lapisan kedua" menjadi **benar untuk pertama kalinya**.
- Deployment harus mendukung dua kredensial. Lewat Supabase pooler, username
  role baru harus membawa project ref. **Harus diverifikasi di deployment
  target, bukan diasumsikan** — itu satu-satunya langkah yang belum terbukti.
- Role baru butuh `GRANT` per tabel (35) dan default privilege per schema.
  Ini skrip SQL, bukan perubahan kode aplikasi.
- Opsi C D-03 (`SET LOCAL app.tenant_id` sambil tetap owner) tetap **ditolak**:
  data runtime membuktikannya tidak membantu. Aplikasi memang tidak pernah
  memanggil `set_config` sama sekali, jadi `app.tenant_id` selalu NULL di
  jalur aplikasi.

## Alternatif yang ditolak

- **B (owner, satu layer)** — ditolak. Runtime membuktikan 4 tenant terlihat
  dari satu sesi yang sah. Ini bukan "layer yang tidak ada", ini kebocoran
  nyata yang hanya tertutupi ketelitian ~60 predikat aplikasi.
- **C (`SET LOCAL` per request)** — ditolak, dan sekarang terbukti salah
  secara mekanis, bukan hanya secara teori.
- **`FORCE` tanpa ganti role** — ditolak oleh `rolbypassrls = true`.

## Yang harus diperbaiki setelah ini

Semua ini **tidak** berubah sebagai bagian dari ADR ini; dicatat agar tidak
dikira sudah beres:

- BE-001 ditutup hanya setelah langkah 4 teruji di deployment target.
- D-14 (claim seeding) **tidak** terkait dan **tidak** boleh digabung dengan
  perubahan ini. Mengganti role DB adalah edit berisiko tertinggi di audit ini.
