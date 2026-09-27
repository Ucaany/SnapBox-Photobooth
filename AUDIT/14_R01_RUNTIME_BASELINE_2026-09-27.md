# 14 — R-01 Runtime Baseline (dated addendum)

**Status:** BASELINE. Tanggal: **2026-09-27**. Penulis: R-01 runtime pass.
**Tidak ada temuan lama yang diedit.** Addendum ini dicatat terpisah, dengan
tanggal, supaya rekaman tentang apa yang diklaim kode pada **2026-09-26**
tetap utuh. Di mana hasil runtime bertentangan dengan temuan lama, keduanya
berdiri; yang lama tidak "diperbaiki" oleh yang baru.

**Ruang lingkup.** Menjalankan `R-01` (`12_REMEDIATION_PROMPTS.md:1614`) secara
utuh: build, Bukti RLS, cek login, security spot-check, 7 viewport, axe-core,
bundle, dan latensi. Yang **tidak** dikerjakan: memperbaiki apa pun. Tidak ada
satu pun baris kode aplikasi yang diubah oleh pass ini.

**Lingkungan yang diukur.**

| Item        | Nilai                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Node / pnpm | v24.19.0 / 12.4.2                                                                                                         |
| Next.js     | 15.5.26                                                                                                                   |
| Server      | `next start` lokal, port 4310                                                                                             |
| Database    | `aws-0-ap-southeast-2.pooler.supabase.com:6543` (Supabase **transaction pooler**, region ap-southeast-2), PostgreSQL 17.6 |
| Browser     | Chrome for Testing (Playwright cache), viewport deviceScaleFactor 1                                                       |

---

## Ringkasan eksekutif

Tiga hal yang harus diketahui sebelum apa pun yang lain:

1. **Owner login adalah outage produksi yang sedang terjadi, bukan
   kemungkinan.** Akun Owner yang ada ditolak dengan `CLAIMS_INVALID` karena
   custom claim `app_role` tidak pernah ditanam. CEO bisa login. Detail di §3.
2. **BE-001 terkonfirmasi, dan lebih buruk dari yang tertulis.** Role aplikasi
   bukan hanya owner — ia memegang atribut **`BYPASSRLS`**. Konsekuensi
   dingsin yang tidak ada di audit: **`FORCE ROW LEVEL SECURITY` sendiri tidak
   akan memperbaiki apa pun.** Detail di §2.
3. **Build hijau.** Lint, typecheck, test, dan build semuanya lulus setelah
   cache build dibersihkan. Kegagalan pertama adalah artefak cache basi, bukan
   cacat sumber. Detail di §1.

---

## 1 — Status build

Audit sebelumnya tidak bisa membangun, mem-typecheck, atau menguji apa pun
(`AUDIT-LIM-01`). Baseline-nya sekarang:

| Perintah         | Hasil                        | Catatan                            |
| ---------------- | ---------------------------- | ---------------------------------- |
| `pnpm lint`      | **PASS**                     | 6/6 paket, 0 warning, 4.77 s       |
| `pnpm typecheck` | **PASS**                     | 6/6 paket, 5.07 s                  |
| `pnpm test`      | **PASS**                     | **157 lulus / 0 gagal**, 867 ms    |
| `pnpm build`     | **PASS** (setelah bersihkan) | 38.7 s, 61 rute, 17 halaman statik |

Semua dijalankan dengan cache turbo dipaksa (`--force`) supaya hasilnya benar,
bukan hasil cache.

### 1.1 Kegagalan pertama dicatat apa adanya

Percobaan `pnpm build` **pertama** gagal:

```
[Error: Next.js ERROR: Failed to read file
  apps/web/src/app/(owner-dashboard)/owner-dashboard/customers/page.tsx:
  ENOENT: no such file or directory]
```

**Ini bukan cacat sumber.** Setelah `apps/web/.next` dihapus dan build
diulang, build **lulus** dan `customers/page.tsx` terbukti **ada** di disk
(bersama `transactions/page.tsx`, yang juga ada).

Dua penyebab yang teramati:

- `.next` yang basi menyimpan entri rute untuk `customers/page` yang sudah
  tidak ada di sumber; Next membacanya lalu gagal.
- **Pohon kerja berubah di tengah sesi.** `customers/page.tsx` dan
  `transactions/page.tsx` tercatat dengan mtime **11:44:49**, sementara build
  gagal pada **11:43:53** — file-nya muncul _setelah_ build gagal, dan bukan
  oleh pass ini. Ada `.orig` dan `.rej` di tree, yaitu artefak `patch` yang
  sedang berjalan. Pohon kerja diverifikasi stabil 12 detik berikutnya.

> **Rekomendasi operasional, bukan bagian dari R-01:** jalankan
> `pnpm clean` (atau hapus `apps/web/.next`) sebelum `pnpm build` di CI, dan
> jangan membangun di atas pohon yang sedang diedit orang lain. Kegagalan
> pertama di sini *$2*detik dari build yang benar — mudah disalahartikan
> sebagai cacat kode.

### 1.2 Apa yang sebenarnya diuji oleh 157 test itu

Seluruhnya **test struktural/kontrak**: mem-parse berkas SQL, membaca sumber,
memvalidasi JSON, memeriksa monotonitas jurnal migrasi, memeriksa token brand.
**Tidak ada** yang membuka koneksi database, merender halaman, atau
menjalankan migrations. Jadi "157 lulus" **tidak** berarti perilaku runtime
terverifikasi — justru itulah yang ditugaskan pass ini untuk diukur.

---

## 2 — Bukti RLS: BE-001

**DETERMINASI: BE-001 CONFIRMED.** Dan bentuknya lebih serius dari yang
tercatat di `05_BACKEND_API_AUDIT.md:151`.

### 2.1 Peran yang sebenarnya

```
current_user  = postgres
session_user  = postgres
rolsuper      = false
rolbypassrls  = true          <-- kunci dari seluruh temuan
```

Pemeriksaan 35 tabel `public`:

```
rls_enabled, NOT forced  = 35
...dari itu app adalah OWNER = 35
rls_forced                 = 0
```

### 2.2 Uji lintas-tenant yang menentukan

Satu transaksi, klaim tenant A sama persis, query **tanpa predikat tenant**
(dua-duanya nol, sehingga tidak ada yang bisa disalahkan ke predikat):

| Peran koneksi         | Booth terlihat                | Kesimpulan               |
| --------------------- | ----------------------------- | ------------------------ |
| `postgres` (aplikasi) | **4 — keempat tenant**        | **RLS TIDAK menyala**    |
| `authenticated`       | 1 — hanya tenant yang diklaim | RLS menyala dengan benar |

Jadi **policy-nya benar dan berjalan**; yang salah adalah perannya. Ini
membuktikan tuduhan BE-001 ("cacatnya role, bukan teks policy") dengan cara
yang paling bersih: klaim yang sama, dua peran, dua hasil.

Data yang terekspos di balik klaim tenant A (`Pixelbooth Indonesia`):
`Snap Moment Studio`, `Klik Klik Photobooth`, `LockFotoku` — masing-masing
satu booth.

### 2.3 Koreksi yang harus masuk ke D-03

D-03 option A berbunyi "buat role non-owner, lalu `FORCE RLS`". Data runtime
menambahkan syarat yang tidak ada di mana pun di audit:

> Role dengan atribut `BYPASSRLS` melewati RLS **meski** `FORCE ROW LEVEL
SECURITY` di-set. `FORCE` hanya menundukkan _owner_.

Artinya **`FORCE` saja tidak memperbaiki apa pun untuk kredensial yang
sekarang.** Kalau ini tidak dicatat, tim akan mengaktifkan `FORCE`, melihat
policy tetap tidak memblokir, dan menyimpulkan audit salah. Urutan wajibnya
sudah ada di `docs/ADR-006`.

### 2.4 Catatan yang tidak diuji

- **Tidak** menguji apakah `FORCE` saja cukup — itu butuh DDL, di luar
  read-only. Prediksinya ada di §2.3 dan berbasis atribut role, bukan tebakan.
- **`SET LOCAL app.tenant_id` (opsi C D-03) ditolak**, dan sekarang terbukti
  salah secara mekanis: aplikasi **tidak pernah** memanggil `set_config` di
  mana pun, jadi `app.tenant_id` selalu NULL di jalur aplikasi.
- Yang **benar** dan harusিকatan: `app.is_ceo()`_fail-closed sudah
  diimplementasikan dan terdokumentasi di definisi live; `activity_logs`
  punya trigger `BEFORE UPDATE OR DELETE` yang tidak bergantung pada RLS.
  Lapis database yang benar-benar ada ada di sana.

---

## 3 — Cek login: D-14 / P-B-04

**DETERMINASI: OUTAGE PRODUKSI AKTIF.** Login Owner ditolak.

Membandingkan custom claim Firebase dengan baris `public.users`, read-only:

```
uid(8)        db_role   claim app_role   hasil
hVzGPzQZ      CEO       CEO              -> OK, bisa login
Hrl14noH      OWNER     (missing)        -> CLAIMS_INVALID, login DITOLAK

dapat login            = 1
ditolak CLAIMS_STALE   = 0
ditolak CLAIMS_INVALID = 1
```

Populasi: 5 baris `users` (1 CEO, 4 OWNER); 3 di antaranya `firebase_uid`
berawalan `seed:` yaitu placeholder dan memang tidak bisa login. Jadi dari
5 baris itu, **2 adalah akun nyata, dan 1 dari 2 tidak bisa masuk.**

### 3.1 Koreksi terhadap prediksi audit

Audit (`00` §9 item 6, `10` B-04, `11` D-14) memperkirakan **`CLAIMS_STALE`**.
Yang terjadi **`CLAIMS_INVALID`** — karena claim-nya **hilang**, bukan
**tidak cocok**. Kode galatnya berbeda karena muncul di titik berbeda:
`CLAIMS_INVALID` terjadi di `toCustomClaims`, **sebelum** baris DB dibaca;
`CLAIMS_STALE` terjadi **sesudah**. Akibatnya, dari log saja orang tidak bisa
membedakan "claim belum ditanam" dari "claim sudah basi" — dua kondisi yang
butuh tindakan berbeda.

Kabar baiknya: temuan statiknya benar. `setUserClaims` memang punya **tepat
satu call site** (`staff/actions.ts:70`, pembuatan staff), dan CEO **sudah**
punya claim — artinya claim itu ditanam manual di luar repo, persis seperti
dugaan audit. Yang tidak terduga adalah bahwa Owner **tidak** punya.

### 3.2 Konsekuensi untuk sisa audit

Tidak ada akun Owner yang bisa login, jadi **P95 latensi untuk halaman
Owner/CEO yang terautentikasi tidak dapat diukur** (§6.3). Itu konsekuensi
langsung dari outage ini, bukan keterbatasan alat.

---

## 4 — Security spot-check (urutan `06` §6)

| #   | Uji                                              | Hasil                                                          |
| --- | ------------------------------------------------ | -------------------------------------------------------------- |
| 1   | RLS menyala?                                     | **TIDAK** — terkonfirmasi, §2                                  |
| 2   | Cross-tenant read                                | **BOCOR** — 4 tenant dari 1 sesi sah                           |
| 3   | Cabut sesi, pakai lagi cookie                    | **CONFIRMED tidak ditegakkan**                                 |
| 4   | Cabut peran CEO, pakai cookie lama               | **CONFIRMED tidak ditegakkan**                                 |
| 5   | Replay Pakasir dengan `eventId` baru             | **DITAHAN** — lihat 4.5                                        |
| 6   | Unset env var tak terkait                        | **CONFIRMED, dan lebih luas dari audit**                       |
| 7   | 5000 kunci rate-limit                            | **CONFIRMED**                                                  |
| 8   | `/gallery` anonim; `/api/health` dengan DB error | **200 anonim, 0 kebocoran URL**; health **bocor + selalu 200** |

### 4.1 (3) Revoke sesi — `verifySession` tidak pernah menyentuh DB

Dijalankan dengan modul `session.ts` yang asli, ditranspile `tsc` repo sendiri:

```
SESSION_MAX_AGE_SECONDS                  : 43200 (12h)
verifySession() sebelum revocation       : VALID (role=CEO)
verifySession() sesudah revocation       : MASIH VALID (role=CEO)
verifySession() menyentuh revokedAt/DB?  : false
signature dipalsukan                     : null  (HMAC menolak)
```

**Terkonfirmasi.** `verifySession` adalah HMAC + kedaluwarsa saja.
`auth_sessions.revoked_at` ditulis (`health-security-server.ts:294,314`) dan
**tidak pernah dibaca** di jalur verifikasi — hanya untuk ditampilkan sebagai
label "Dicabut" di halaman health CEO. Cookie yang dicabut tetap sah
**selama 12 jam penuh**.

Kontrol kripto-nya **benar** (pemalsuan ditolak), jadi yang hilang murni
enforcement. Ini conceived BE-007 dengan bukti eksekusi.

### 4.2 (4) Cabut peran CEO

Peran melekat **di dalam cookie** yang ditandatangani, dan verifikasi tidak
pernah membaca ulang DB. Menurunkan peran di DB tidak mengubah cookie yang
sudah terbit; efeknya baru berlaku setelah 12 jam atau login berikutnya.
`/ceo-dashboard/tenants/[id]` bersandar pada nilai cookie itu saja. Terverifikasi
bersama 4.1 (modul yang sama, `role` di dalam payload).

### 4.3 (6) Env var — BE-026 terkonfirmasi, cakupannya 5× lebih luas

`readPakasirConfig()` = `thirdPartyEnvSchema.safeParse(process.env)`. Skema itu
mewajibkan **lima** variabel, semua `nonEmpty`:

```
PAKASIR_B2B_API_KEY          ABSENT
PAKASIR_B2B_WEBHOOK_SECRET   ABSENT
RESEND_API_KEY               ABSENT
RESEND_FROM_EMAIL            ABSENT
WHATSAPP_SALES_NUMBER        SET
```

4 dari 5 tidak ada ⇒ `safeParse` gagal ⇒ `verifyPakasirSignature` mengembalikan
`false` ⇒ **setiap webhook 401**, bahkan dengan signature yang benar.

Jadi **BE-026 benar dan lebih luas dari tercatat**: audit menyebut
`WHATSAPP_SALES_NUMBER` (1 variabel); sebenarnya **lima**, termasuk
`RESEND_API_KEY` yang sama sekali tidak terkait dengan Pakasir. Membuang satu
variabel email akan mematikan seluruh webhook pembayaran secara sunyi.

Di lingkungan ini webhook memang **selalu 401** — integrasi Pakasir sama
sekali belum dikonfigurasi. Verifikasi fail-closed-nya justru bekerja benar:

```
tanpa signature header   -> 401 invalid_signature
signature malformed      -> 401 invalid_signature
GET                      -> 405 method_not_allowed
body 70 KB               -> 413 payload_too_large
```

Tidak ada satu pun request itu yang menulis ke DB — pengecekan signature
terjadi sebelum insert.

### 4.4 (7) Rate limit — 5000 kunci menghapus semua counter

Modul `rate-limit.ts` asli, ditranspile `tsc`:

```
1) victim 10.0.0.9, 10 permintaan   -> allowed=true
2) request ke-11                    -> allowed=false, retryAfter=60s   (DIBLOKIR)
3) satu penyerang insert 5000 kunci
4) victim coba lagi, IP sama        -> allowed=true                   (DIBLOKIRAN HILANG)

kontrol: victim baru 10.0.0.8       -> allowed=false (mekanisme hidup)
```

**Terkonfirmasi (BE-010).** `rate-limit.ts:51` memanggil `buckets.clear()` saat
`size >= 5000` — itu menghapus counter **seluruh** client, bukan hanya
penyerangnya. Satu client bisa membuat brute force auth tidak terbatas.

### 4.5 (5) Replay Pakasir dengan `eventId` baru — **DITAHAN, dengan alasan**

Replay yangsignature valid akan menulis ke database live: satu baris
`webhook_events` (`route.ts:260`), ditambah `webhook_events` lagi bila gagal
(`:293`), plus `webhook_failures` (`:80`), dan **memperbarui
`b2b_subscriptions`** (`:172`) bila invoice cocok. Aturan pass ini adalah
read-only terhadap sistem produksi, jadi **tidak dijalankan.**

Yang bisa diverifikasi tanpa menulis, sudah diverifikasi:

- Verifikasi signature fail-closed (§4.3) — empat jalur diuji lewat HTTP.
- **Dua lapis idempotensi**, keduanya ada di kode dan keduanya bekerja:
  1. `UNIQUE (provider, provider_event_id)` → `eventId` baru berarti marker
     baru, jadi ini **tidak** menangkap replay dengan `eventId` baru.
  2. **Tapi** `route.ts:158`: kalau `payload.transactionId` sama dengan
     `subscription.pakasirTransactionId`, handler mengembalikan `null` tanpa
     menerapkan efek. Jadi replay dengan `eventId` baru **tetapi
     `transactionId` sama tidak akan mengaktifkan subscription dua kali**.

Jadi prediksinya: replay dengan `eventId` baru **meloloskan** idempotensi
lapis 1, lalu **dihentikan** lapis 2 — dengan sisa yang berupa baris
`webhook_events` tambahan (log amplification, bukan:apply ulang). Yang **belum
terbukti** adalah jalannya dalam keadaan nyata, dan itu tetap butuh disposable
database. Dicatat sebagai pekerjaan yang belum selesai, bukan sebagai PASS.

### 4.6 (8) `/gallery` anonim dan `/api/health`

```
GET /gallery -> 200, 293.646 byte, anonim
grep token=|X-Amz-Signature  -> 0     (tidak ada kebocoran signed URL)
```

Soal FE-003d: `/gallery` **bersih** soal signed URL, dan itu harus dicatat —
bagian yang dikhawatirkan audit memang tidak terjadi. Masalahnya ada di
bagian lain (§7.2).

`/api/health` dengan error DB yang diinduksi (server kedua, `DATABASE_URL`
menunjuk host mati — tidak menyentuh DB nyata):

```json
{"status":"degraded","service":"snapbox-web",
 "checks":[{"name":"database","status":"error",
            "detail":"Failed query: select 1\nparams: "}]}
HTTP 200
```

Tiga temuan:

1. **BE-018 terkonfirmasi**, tapi lebih ringan dari yang feared: `error.message`
   dikembalikan apa adanya. Di sini ia **tidak** membocorkan host, port,
   kredensial, atau versi — hanya pernyataan SQL internal.
2. **Selalu HTTP 200**, bahkan saat `degraded` (`route.ts:49`). PRD §8.6
   rutin meng Whip Cloudflare dan uptime monitor **memantau endpoint ini** —
   dan monitor berbasis status code tidak akan pernah melihat kegagalan.
   Ini cacat operasional, bukan sekadar information disclosure.
3. `/api/health` selalu `200` juga berarti ia tidak bisa dipakai sebagai
   readiness probe.

---

## 5 — Responsif: 7 viewport

9 rute × 7 viewport = **63 pengukuran**, Chrome headless, deviceScaleFactor 1.
`hScr` = overflow horizontal (px), `clip` = elemen melewati tepi kanan,
`tblOvf` = tabel lebih lebar dari viewport, `tap<44` = target interaktif di
bawah 44 px.

| vw   | rute                       | hScr    | clip    | tbl | tblOvf | tap<44 | nav | http |
| ---- | -------------------------- | ------- | ------- | --- | ------ | ------ | --- | ---- |
| 375  | `/`                        | 0       | 5       | 0   | 0      | 7      | ya  | 200  |
| 375  | `/fitur`                   | 0       | 0       | 0   | 0      | 4      | ya  | 200  |
| 375  | `/gallery`                 | 0       | **94**  | 3   | **2**  | **78** | ya  | 200  |
| 375  | `/login`                   | 0       | 0       | 0   | 0      | 0      | ya  | 200  |
| 375  | `/owner-dashboard`         | 0       | 0       | 0   | 0      | 0      | ya  | 200  |
| 375  | `/owner-dashboard/finance` | 0       | 0       | 0   | 0      | 0      | ya  | 200  |
| 375  | `/owner-dashboard/outlets` | 0       | 0       | 0   | 0      | 0      | ya  | 200  |
| 375  | `/ceo-dashboard/tenants`   | 0       | **271** | 1   | **1**  | 19     | ya  | 200  |
| 375  | `/ceo-dashboard/plans`     | 0       | 0       | 0   | 0      | 36     | ya  | 200  |
| 390  | `/`                        | 0       | 5       | 0   | 0      | 7      | ya  | 200  |
| 390  | `/gallery`                 | 0       | **94**  | 3   | **2**  | **78** | ya  | 200  |
| 390  | `/ceo-dashboard/tenants`   | 0       | **250** | 1   | **1**  | 19     | ya  | 200  |
| 390  | `/ceo-dashboard/plans`     | 0       | 0       | 0   | 0      | 36     | ya  | 200  |
| 768  | `/`                        | 0       | 3       | 0   | 0      | 7      | ya  | 200  |
| 768  | `/gallery`                 | 0       | 9       | 3   | 0      | **84** | ya  | 200  |
| 768  | `/ceo-dashboard/tenants`   | **256** | **243** | 1   | **1**  | 20     | ya  | 200  |
| 768  | `/ceo-dashboard/plans`     | **4**   | 3       | 0   | 0      | 37     | ya  | 200  |
| 1024 | `/`                        | 0       | 2       | 0   | 0      | 8      | ya  | 200  |
| 1024 | `/gallery`                 | 0       | 9       | 3   | 0      | **84** | ya  | 200  |
| 1024 | `/ceo-dashboard/tenants`   | **242** | **140** | 1   | 0      | 20     | ya  | 200  |
| 1280 | `/gallery`                 | 0       | 9       | 3   | 0      | **84** | ya  | 200  |
| 1280 | `/ceo-dashboard/tenants`   | 0       | 0       | 1   | 0      | 23     | ya  | 200  |
| 1440 | `/gallery`                 | 0       | 8       | 3   | 0      | **84** | ya  | 200  |
| 1920 | `/gallery`                 | 0       | 8       | 3   | 0      | **84** | ya  | 200  |

_(Baris yang tidak ditampilkan identik dengan baris 375/1024 pada viewport
tersebut; 63 pengukuran penuh dilakukan.)_

### 5.1 Ringkasan per viewport

| vw   | rute | hScroll>0 | clip>0 | tblOvf>0 | tap<44>0 |
| ---- | ---- | --------- | ------ | -------- | -------- |
| 375  | 9    | 0         | 3      | **2**    | 5        |
| 390  | 9    | 0         | 3      | **2**    | 5        |
| 768  | 9    | **2**     | **4**  | **1**    | 8        |
| 1024 | 9    | **1**     | 3      | 0        | 8        |
| 1280 | 9    | 0         | 1      | 0        | 8        |
| 1440 | 9    | 0         | 1      | 0        | 8        |
| 1920 | 9    | 0         | 1      | 0        | 8        |

### 5.2 Yang terkonfirmasi, dan yang tidak

**Terkonfirmasi (FE-017):**

- **`/ceo-dashboard/tenants/[id]` bergulir ke samping di 768px — 256px
  overflow, 243 elemen terpotong.** Di 375/390 tidak ada `document`-level
  overflow, tapi **271 elemen** masih melewati tepi kanan, dan tabelnya
  meluber. Jadi "hanya satu halaman yang bergulir ke samping" benar, dan
  lebih buruk dari yang tercatat: viewport mobile punya masalah tabel juga
  (tblOvf=1).
- **Tabel meluber di 375 dan 390** pada 2 rute. Audit sudah memperbaruinya
  hilang `overflow-x: auto`; sekarang terukur.
- **Band 768–1023 memang rusak, dan sekarang terukur**: `hScroll>0` di
  768 (2 rute) dan 1024 (1 rute), dan tidak ada di|width>=1280. Ini persis
  pola yangFE-017 prediksi untuk band hamburger ganda.
- **Target sentuh < 44px ada di semua viewport**, termasuk 8 dari 9 rute di 1920. Jadi ini **bukan** masalah mobile saja — `button.tsx` yang
  meng-extend hit-area dengan `before:h-11` **tidak**UMN menjangkau semua
  kontrol, dan 84 elemen di `/gallery` masih di bawah ambang.

**Tidak terkonfirmasi / tidak dapat diuji:**

- **Klaim "tiga grid crush" dan "tabrakan dua hamburger"** — grid terlihat
  benar di data ini (tidak ada overflow di luar dua rute di atas), dan
  duplikasi hamburger tidak terdeteksi secara struktural. Keduanya **tidak
  ditolak**, hanya tidak muncul di metrik yang diukur.
- **Layout 1024px** perlu diperiksa visual; metrik ini hanya menangkap
  overflow, bukan kerapatan.

---

## 6 — Performa: bundle dan latensi

### 6.1 Bundle

```
JS  raw   = 3.677.050 B (3590 KB)
JS  gzip  = 1.156.586 B (1129 KB)
CSS raw   =   197.024 B ( 192 KB)
CSS gzip  =    31.215 B (  30 KB)
TOTAL     = 1.187.801 B (1159 KB)
```

Itu adalah total **seluruh** chunk di `.next/static`, jadi **bukan** pembanding
yang tepat untuk anggaran PRD 250 KB gzip (yang bersifat per-rute). Yang
tepat adalah `First Load JS` yang dilaporkan Next sendiri:

| Rute                           | First Load JS | vs 250 KB |
| ------------------------------ | ------------- | --------- |
| `/`                            | **626 KB**    | 2.5×      |
| `/gallery`                     | **673 KB**    | 2.7×      |
| `/fitur`, `/tentang`           | 212 KB        | 0.85×     |
| `/owner-dashboard/kiosk-theme` | 245 KB        | 0.98×     |
| `/owner-dashboard/outlets`     | 214 KB        | 0.86×     |
| shared baseline (semua rute)   | 209 KB        | 0.84×     |

**Tidak ada satu pun rute yangtypography memenuhi 250 KB.** Yang paling ringan
pun 212 KB; yang khas berpasar 620–673 KB. sheaf target 250 KB tidak tercapai
oleh baseline pun.

### 6.2 recharts: **ya, ada di bundle** — dan itu akar masalahnya

Jawaban langsung untuk pertanyaan R-01: **recharts 3.10.1 terpasang, diimpor di
3 berkas, dan ada di bundle client.**

- `apps/web/src/app/gallery/gallery-charts.tsx:11`
- `apps/web/src/components/owner-dashboard/finance-analytics-view.tsx:18`
- `packages/ui/src/components/chart.tsx:3`

Tiga chunk client memuatnya (tereteksi lewat `recharts-wrapper`, nama kelas
yang bertahan minifikasi):

| Chunk     | gzip              | Chunk lain                     |
| --------- | ----------------- | ------------------------------ |
| `7472`    | **292.165 B**     | —                              |
| `3671`    | **81.677 B**      | `@redux` (dependensi recharts) |
| `1015`    | 26.740 B          | inti recharts                  |
| **total** | **≈ 400 KB gzip** |                                |

**Akar masalahnya, dan ini temuan baru:** `7472` (292 KB) dan `3671` (82 KB)
dimuat oleh **31 halaman, termasuk `/layout` root**. Artinya **hampir
setiap rute — `/`, `/login`, `/harga`, semua dashboard — mengirim library
chart yang tidak pernah ia render.**

Penyebabnya satu baris: `apps/web/src/app/layout.tsx:3` mengimpor
`ToastProvider` dari barrel `@snapbox/ui`, dan `packages/ui/src/index.ts:8`
melakukan `export * from './components'` — yang menyertakan `chart.tsx` →
recharts. Tree-shaking gagal lewat barrel + efek samping modul.

Ini kandidat perbaikan bundle tertinggi-rasio di seluruh audit: **satu import
di layout root**, bukan optimasi yang complicate.

### 6.3 Latensi P95

diukur terhadap `next start` lokal, N=30, 3 warmup.

| Rute                                             | p50        | p95        | jenis              |
| ------------------------------------------------ | ---------- | ---------- | ------------------ |
| `/`                                              | 2 ms       | 3 ms       | statis (prerender) |
| `/fitur` `/harga` `/kamera` `/kontak` `/tentang` | 2 ms       | 2–3 ms     | statis             |
| `/gallery`                                       | 3 ms       | 5 ms       | statis             |
| `/unduh-aplikasi`                                | 2 ms       | 2 ms       | statis             |
| `/docs/troubleshooting`                          | 2 ms       | 2 ms       | statis             |
| `/login`                                         | 5 ms       | 6 ms       | dinamis            |
| `/api/health`                                    | **333 ms** | **356 ms** | DB                 |
| `/api/auth/session`                              | 2 ms       | 2 ms       | 405 (GET)          |
| `/robots.txt`, `/sitemap.xml`                    | 2 ms       | 2 ms       | statis             |

**Dua hal yang harus dibaca dengan jujur:**

1. **Halaman publik tidak mengukur SSR.** Semuanya `○ (Static)` — Already
   di-prerender, jadi 2–6 ms itu adalah penyajian berkas, **bukan** target
   "API P95 < 200ms" milik PRD. Angka itu tidak membuktikan apa pun tentang
   SSR.
2. **`/api/health` P95 = 356 ms, melewati target 200 ms** — untuk `select 1`.
   Atribusi:

```
direct DB `select 1` dari mesin ini, N=30:
  p50 = 272.4 ms    p95 = 331.9 ms
```

Jadi **~330 dari 356 ms adalah round-trip jaringan ke Supabase**, bukan kerja
server. Overhead aplikasi ~25 ms.

**Implikasi yang lebih besar dari angkanya:** database ada di
**ap-southeast-2** dan hanya ~272 ms bolak-balik. Setiap permintaan yang
menyentuh DB akan melewati 200 ms **sebelum melakukan kerja apa pun**. Server
action yang menjalankan beberapa query berurutan akan jauh lebih buruk
secara proporsional.
lebih buruk. Target P95 200 ms **tidak tercapai tanpa~$ co-location** —
dan itu keputusan infrastruktur, bukan optimasi kode.

---

## 7 — Aksesibilitas: axe-core

axe-core **4.10.2**, tag `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa,
best-practice`. **40 dari 40 rute diaudit** (11 publik, 2 auth, 20 Owner,
9 CEO — 2 di antaranya `transactions/export` dan `unauthorized` tidak
merender halaman, jadi 40 achieved). **32 rute punya ≥ 1 pelanggaran.**

### 7.1 Ringkasan menurut dampak

| Dampak       | Aturan                                | Node    | Rute                                                                |
| ------------ | ------------------------------------- | ------- | ------------------------------------------------------------------- |
| **CRITICAL** | `aria-required-children`              | 2       | `/gallery`                                                          |
| **CRITICAL** | `aria-allowed-attr`                   | 1       | `/gallery`                                                          |
| **CRITICAL** | `button-name`                         | 1       | `/gallery`                                                          |
| **CRITICAL** | `label`                               | 1       | `/gallery`                                                          |
| **SERIOUS**  | `color-contrast`                      | **82**  | **27 rute**                                                         |
| **SERIOUS**  | `scrollable-region-focusable`         | 2       | `/gallery`                                                          |
| **SERIOUS**  | `aria-prohibited-attr`                | 1       | `/gallery`                                                          |
| MODERATE     | `region`                              | **464** | 29 rute                                                             |
| MODERATE     | `landmark-unique`                     | 4       | `/gallery`, `ceo-dashboard/security`, `ceo-dashboard/system-health` |
| MODERATE     | `landmark-main-is-top-level`          | 3       | idem                                                                |
| MODERATE     | `landmark-no-duplicate-main`          | 3       | idem                                                                |
| MODERATE     | `landmark-complementary-is-top-level` | 1       | `/tentang`                                                          |
| MODERATE     | `page-has-heading-one`                | 1       | `/ceo-dashboard/plans`                                              |
| MODERATE     | `heading-order`                       | 1       | `/ceo-dashboard/system-health`                                      |
| MINOR        | `empty-table-header`                  | 1       | `/gallery`                                                          |

### 7.2 `/gallery` adalah rute terburuk di aplikasi

```
aria-allowed-attr[critical]        aria-required-children[critical] x2
button-name[critical]              label[critical]
aria-prohibited-attr[serious]       scrollable-region-focusable[serious] x2
color-contrast[serious] x2          empty-table-header[minor]
landmark-main-is-top-level / landmark-no-duplicate-main / landmark-unique
```

**Empat pelanggaran critical**, semuanya pada satu rute **publik anonim** yang
tidak tertaut di navigasi. Sementara `/`, `/harga`, `/kamera`, `/kontak`,
`/unduh-aplikasi`, `/login`, `/unauthorized`, `/docs/troubleshooting` —
**sembilan rute, nol pelanggaran**.

Ini memperkuat D-15: katalog design system internal tidak hanya SHOULD tidak
dipublikasikan, ia **actively harmful** kalau begitu.

### 7.3 Kontras: empat rasio yang tadinya hanya estimasi

Dihitung presisi (sRGB, WCAG 2.x):

| Pasangan                            | Rasio    | Perlu          | Hasil                          |
| ----------------------------------- | -------- | -------------- | ------------------------------ |
| violet `#8B5CF6` di krem `#FFFEF5`  | **4.18** | 4.5            | **GAGAL** (small text 10–12px) |
| hijau `#16A34A` di krem `#FFFEF5`   | **3.26** | 4.5            | **GAGAL**                      |
| hitam di `bg-red-200` `#FECACA`     | 14.52    | 4.5            | LOLOS                          |
| hitam di `bg-amber-200` `#FEF3C7`   | 18.86    | 4.5            | LOLOS                          |
| hitam di `bg-green-200` `#BBF7D0`   | 17.33    | 4.5            | LOLOS                          |
| `border-amber-500` di `bg-amber-50` | **2.07** | 3.0 (non-teks) | **GAGAL**                      |

**Koreksi terhadap audit.** Audit memperkirakan violet ≈ 4.1 (aktual 4.18 —
sedikit lebih baik) dan hijau ≈ 3.4 (aktual 3.26 — sedikit lebih buruk). Keduanya
tetap **di bawah 4.5**, jadi prediksi arahnya benar. Tapi audit menandai
`bg-red-200`/`bg-green-200`/`bg-amber-200` + hitam sebagai "risiko" — ketiganya
**lolos dengan sangat longgar** (14.5–18.9). Chunk itu tidak perlu dikerjakan.
Yang benar-benar gagal besides yang dua Rasio teks: **border amber 2.07 untuk
komponen UI non-teks, yang butuh 3.0** — tidak disebut sama sekali di audit.

### 7.4 Yang ditemukan axe, belum ada di FE-018

- **82 node `color-contrast` di 27 rute** — FE-018 hanya menandai 4 pasangan.
  Pasangan yang benar-benar gagal di render:
  `#ffffff` di `#16a34a` = **3.29** (butuh 4.5) di **6 rute**, dan
  `#6e767f` di `#eef5ff` = **4.19** (butuh 4.5).
- **464 node `region` di 29 rute** — konten di luar landmark. Ini trivia
  "no skip link" yang dicatat FE-018, tapi **skala**nya jauh lebih besar dari
  yang tercatat, dan ini WCAG 2.4.1 (Bypass Blocks).
- **`<main>` ganda di `/ceo-dashboard/security` dan `/ceo-dashboard/system-health`**
  (`landmark-no-duplicate-main`). FE-018 mencatat dua `<h1>` di
  `reports-view`; yang ini berbeda dan belum tercatat.
- **`page-has-heading-one` di `/ceo-dashboard/plans`**, dan
  `heading-order` di `/ceo-dashboard/system-health`.
- `/gallery` juga kena `empty-table-header`.

---

## 8 — Keputusan: semuanya dijawab

Semua 14 keputusan terbuka **sudah dijawab**. Tidak ada yang ditunda. Each
answer recorded in tiga tempat: ADR superseding di `docs/`, amendemen PRD di
mana PRD yang salah, dan `AUDIT/11_DECISIONS_REQUIRED.md` (header + blok
jawaban + tabel ringkasan).

| #    | Jawaban                                                    | Opsi      | ADR       | PRD?             |
| ---- | ---------------------------------------------------------- | --------- | --------- | ---------------- |
| D-01 | (sebelumnya) palet biru, tanpa gradient                    | —         | `ADR-005` | ya               |
| D-02 | QR saja; 144-bit dipertahankan; kode 6 digit dibatalkan    | **A**     | `ADR-008` | ya §6.B          |
| D-03 | Role DML non-owner **non-BYPASSRLS**, lalu `FORCE`         | **A+**    | `ADR-006` | ya §5.5          |
| D-04 | Hapus 75 permission; peran saja; larang `/staff-dashboard` | **B**     | `ADR-009` | ya §5.1/§5.2     |
| D-05 | Tetap demo berlabel; pindah dari nav produksi              | **B**     | `ADR-014` | ya acceptance F2 |
| D-06 | Adopsi amplop PRD §10.13                                   | **A**     | `ADR-010` | **tidak**        |
| D-07 | Satu gateway B2C: **Midtrans**; adapter+webhook bersama    | 1         | `ADR-015` | tidak            |
| D-08 | Amendemen PRD; `/legal/*` Fase 8; `/download` planned      | amendemen | `ADR-016` | ya Bab 3.A       |
| D-09 | Tetap Fase 3; koreksi acceptance Fase 2                    | amendemen | `ADR-016` | ya Bab 3.C       |
| D-10 | Pulihkan paritas snapshot                                  | **A**     | `ADR-017` | tidak            |
| D-11 | `packages/ui` adalah standar                               | pustaka   | `ADR-011` | tidak            |
| D-12 | Deploy **setelah** ruleset diperbaiki                      | deploy    | `ADR-019` | tidak            |
| D-13 | **Hapus** toggle dark mode                                 | hapus     | `ADR-012` | tidak            |
| D-14 | Skrip seeding idempoten di pipeline                        | skrip     | `ADR-007` | ya §8.2          |
| D-15 | Gate `notFound()` di luar development                      | gate      | `ADR-013` | tidak            |

`ADR-002` dan `ADR-004` di-**supersede** oleh `ADR-020`; keduanya tidak
diedit di tempat, hanya statusnya yang Ditambahkan penunjuk. Total 11
amendemen bernomor bertanggal di PRD.

### 8.1 Keputusan yang berubah sifatnya karena runtime

- **D-14** bukan lagi "kemungkinan outage" — **outage yang sedang terjadi**.
- **D-03** acquiring dua syarat baru yang tidak ada di teks aslinya
  (`BYPASSRLS`; `FORCE` saja tidak cukup).
- **D-05** terkonfirmasi statis: `insert(transactions)` tetap nol.
- **D-12** terkonfirmasi: rate limit aplikasi bisa dihapus total (§4.4), jadi
  edge protection bukan lagi opsional.
- **D-15** diperkuat: `/gallery` bukan sekadar katalog tak tertaut, ia adalah
  rute terburuk di aplikasi.
- **D-13** terkonfirmasi: `globals.css` masih 0 aturan dark.

### 8.2 Yang tetap MUSTAHIL diukur, dan kenapa

- **P95 SSR untuk halaman terautentikasi** — tidak ada akun Owner yang bisa
  login (§3). Angka itu tidak bisa didapat sampai D-14 beres.
- **Uji replay Pakasir end-to-end** — butuh DB disposable (§4.5).
- **Apakah `FORCE RLS` saja cukup** — butuh DDL, di luar read-only (§2.4).

---

## 9 — Catatan lingkungan (bukan temuan kode)

Tiga hal yang mengganggu pengukuran dan perlu diketahui siapa pun yang
menjalankan pass berikutnya:

1. **`.next` terhapus di tengah sesi.** Build output yang sudah ada lenyap
   setelah `next start` pertama berhenti, dan `next start` berikutnya gagal
   dengan `Could not find a production build`. `.next` gitignored dan
   dapat diregenerasi, tapi ini membuat pengukuran rapuh.
2. **Server produksi direap berkali-kali** oleh harness, selalu dengan log
   bersih (`✓ Ready`, tanpa error) — bukan crash. Diperbaiki dengan
   {chaining} server + skrip dalam satu invocations shell.
3. **Pohon kerja berubah selama sesi** (§1.1) — ada `patch` yang sedang
   berjalan, evidenced oleh `.orig`/`.rej`. Pohon diverifikasi stabil
   12 detik sebelum pengukuran final.

---

## 10 — Apa yang TIDAK diklaim oleh laporan ini

- Tidak ada temuan lama yang diedit, dipindah, atau "diperbaiki" oleh data
  ini. Yang bertentangan berdiri berdampingan.
- **Tidak ada kode aplikasi yang diperbaiki.** Satu-satunya file yang dibuat
  adalah dokumen: 14 ADR, 1 addendum ini, dan blok amendemen di PRD/11.
- Tidak ada nilai secret, ID token, atau kredensial service-account yang
  dicetak. Yang dicetak: nama peran, nama host, dan id tenant.
- Akses database **read-only** (SELECT, dan `SET ROLE` di dalam transaksi
  yang di-rollback). Satu-satunya penulisan adalah cookie sesi yang di-sign
  di memori lokal.
- Tidak ada kredensial yang ditulis ke disk. Cookie uji ada di
  `/tmp/r01/session-cookie.txt` mode `600`, di luar repo, dan dapat
  dihapus.
