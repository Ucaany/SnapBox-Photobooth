# ADR-005: Palet Biru Sepenuhnya, Tanpa Gradient

## Status

Diterima. Menggantikan `ADR-002` pada titik yang tadinya setengah benar, dan
menjadi sumber kebenaran palet untuk seluruh repo.

Tanggal: 2026-09-26. Pemicu: `AUDIT/11_DECISIONS_REQUIRED.md` D-01, dijawab
2026-09-26.

## Konteks

`ADR-002` mencatat bahwa palet neobrutalism.dev yang dipakai repo adalah biru
(`--main: hsl(217, 100%, 66%)`, kira-kira `#5294ff`) dan bukan kuning SnapBox
`#FFDD00`, lalu menyatakan PRD Bab 4 "usang" untuk bagian token dan warna.

Masalahnya: **hanya separuh yang benar.** Palet itu benar-benar biru di
dashboard Owner dan CEO, dan sama sekali tidak biru di dua permukaan lain.
Tiga identitas berbeda dalam satu aplikasi:

| Permukaan                 | Palet                  | Didefinisikan di                                         | Punya token? |
| ------------------------- | ---------------------- | -------------------------------------------------------- | ------------ |
| Dashboard Owner + CEO     | biru neobrutalism.dev  | `globals.css` blok `:root`                               | Ya           |
| Marketing publik + auth   | kuning/violet/pink PRD | `globals.css` scope `public-*`/`auth-*` + ~30 hex inline | **Tidak**    |
| Default editor tema kiosk | merah/violet/cream     | `kiosk-theme-contract.ts`                                | Tidak        |

Plus satu default keempat yang tidak tercatat di tabel mana pun: default kolom
`kiosk_themes` di `packages/db/src/schema.ts` masih kuning PRD, dan
`kiosk-theme-server.ts` menyisipkan baris tanpa warna, jadi **default database
yang menentukan tema kiosk yang benar-benar tampil**.

Penyebabnya bukan kelalaian sporadis. `content/public.ts` mengekspor objek
`BRAND` yang dirancang sebagai sumber tunggal palet publik, dan **nol berkas
mengimpornya**. Keputusan yang diambil di ADR tidak punya mekanisme untuk
menyebar, sehingga marketing dibangun dengan palet berbeda tanpa siapa pun
perlu menyadarinya. Audit menemukan 208 nilai Tailwind arbitrer di scope publik,
semuanya hex yang ditulis tangan.

## Keputusan

Pemilik proyek memutuskan: **palet sepenuhnya biru, dan tidak ada gradient.**

1. Ramp biru neobrutalism.dev yang sudah ada di blok `:root` menjadi satu palet
   brand tunggal untuk ketiga permukaan, plus auth dan default kiosk.
2. Palet PRD dan palet editor kiosk dicabut.
3. Tidak ada gradient brand, di berkas mana pun.
4. Diterapkan ke **semua berkas**, bukan hanya permukaan yang sedang salah.

Ini adalah **opsi B** dari tiga opsi yang ditawarkan D-01.

### Sumber kebenaran dan mekanisme

`BRAND.palette` di `apps/web/src/content/public.ts` adalah sumber kebenaran
tunggal. Tujuh tokennya:

| Token CSS                | Nilai     | Peran                                                       |
| ------------------------ | --------- | ----------------------------------------------------------- |
| `--brand-primary`        | `#5294FF` | isian utama, tombol, badge. Sama dengan `--main`            |
| `--brand-primary-strong` | `#1D4ED8` | **teks** di atas permukaan terang (6.7:1 di putih)          |
| `--brand-primary-mid`    | `#2563EB` | langkah tengah ramp                                         |
| `--brand-tint`           | `#93C5FD` | teks di atas latar gelap, isian dekoratif (10.4:1 di tinta) |
| `--brand-mist`           | `#DCEBFE` | permukaan pucat. Sama dengan `--background`                 |
| `--brand-surface`        | `#FFFFFF` | permukaan kartu dan shell                                   |
| `--brand-ink`            | `#141414` | tinta dan garis, bahasa neobrutalism. Bukan warna brand     |

`--brand-primary` dan `--brand-mist` sengaja bernilai sama dengan `--main` dan
`--background` supaya ramp dashboard dan ramp marketing benar-benar satu ramp,
bukan dua ramp yang kebetulan sama-sama biru.

Tujuh token itu disalin ke blok `:root` dan dipetakan ke `--color-brand-*` di
`@theme inline`, pada **kedua** berkas CSS, oleh
`scripts/check-brand-palette.mjs`..makeUp_plan:

- `pnpm brand:sync` menulis ulang blok hasil generate.
- `pnpm check:brand` memverifikasi blok itu masih cocok dengan `BRAND.palette`.

Uji keberhasilan yang dipakai: **mengubah satu warna brand adalah satu edit**
(`public.ts`), lalu satu perintah. Bukan pencarian-ganti seluruh repo.

Dua lapis penjaga yang sudah ada ikut berlaku: `check:token-sync` membandingkan
kedua salinan CSS, jadi blok `:root` dan `@theme inline` tidak bisa melenceng
antara `packages/ui` dan `apps/web`.

### Gradient yang dihapus

Tiga gradient brand, semuanya di `apps/web/src/app/globals.css`:

1. `.public-hero` `linear-gradient(135deg, ...)` — diganti warna solid
   `--brand-primary`.
2. `.public-hero` pada `>=768px` `linear-gradient(120deg, ...)` — **blok
   `@media` ini dihapus seluruhnya.** Override breakpoint hanya ada karena sudut
   gradient berubah; satu warna solid tidak punya yang di-override.
3. `.public-gradient-text` dengan `background-clip: text` dan
   `color: transparent` — diganti teks solid `--brand-primary-strong`, dan
   kelasnya diubah jadi `.public-vision-text` karena namanya akan jadi bohong.

Aturan penting: `color: transparent` **tidak boleh** dipertahankan pada item 3.
Tanpa `background-image`, teks itu menjadi tidak terlihat sama sekali, jadi
"hapus gradient" tanpa mengganti warna bukan penghapusan, melainkan pemengusan
elemen.

### Yang tetap ada: peta transparansi

Peta transparansi 8px di `.checkerboard` tetap. Ia dibangun dari empat
`linear-gradient()`, jadi secara harfiah gradient, tapi itu affordance standar
untuk menunjukkan transparansi gambar, **bukan** identitas brand, dan PRD Task
2.5 mewajibkan checkerboard di Frame Studio. Pemilik sudah menyetujui
pengecualian ini pada 2026-09-26.

Allowlist di `check-brand-palette.mjs` sengaja berbasis **posisi**, bukan
jumlah: gradient hanya boleh berada di dalam blok `.checkerboard`. Bentuk ini
membuat allowlist ikut mati sendiri. Menghapus `.checkerboard` menutup semua
gradient, dan gradient baru di berkas mana pun tetap gagal.

## Kenapa ADR-002 menjadi BENAR, bukan setengah benar

`ADR-002` sebelum ADR ini setengah benar dalam dua titik, dan keduanya sekarang
selesai:

1. **Palet.** ADR-002 mencatat biru sebagai keputusan sadar sambil menyatakan
   PRD "usang", lalu marketing dikirim dengan palet PRD. Sekarang biru berlaku
   di mana-mana, jadi catatan ADR-002 cocok dengan kode.
2. **`themeColor`.** ADR-002 eksplisit menandai `layout.tsx` yang masih
   `#FFDD00` sebagai warisan yang "perlu diselesaikan (samakan ke biru, atau
   ganti palet ke kuning)". Opsi "samakan ke biru" sekarang yang terjadi.

ADR-002 **tidak** dicabut dan **tidak** ditulis ulang. Isinya masih berlaku
dan masih benar; yang berubah adalah applicability-nya. Ia tetap sumber
kebenaran untuk tipografi, tap target, kontras error, primitif, impor internal,
masalah `motion.tsx`, `--color-sidebar`, instalasi token ganda, dan
`tw-animate-css`. Bagian "PRD Bab 4 sekarang usang" di situ sekarang benar
penuh, bukan setengah.

## Yang belum diputuskan, sengaja tidak ditebak

**Lebar border** dan **offset hard-shadow** TIDAK ikut diputuskan D-01, dan
tidak ditebak di sini.

Alasan disengaja: token yang salah terlihat sudah diputuskan. Kalau
`--brand-border: 3px` tertanam di blok token sementara kenyataannya owner 2px,
guard berikutnya akan tegakkan tebakan itu seolah-olah sudah disepakati, dan
pelanggan yang tertokeni itu akan jauh lebih mahal diperbaiki daripada ruang
kosong sekarang.

Status sebenarnya sekarang: keduanya sudah tidak konsisten jauh sebelum ADR ini
diterima. PRD Bab 4 meminta border 3-4px dan `6px 6px 0`, sementara 318 dari 358
deklarasi border adalah `border-2`, token shadow `4px 4px 0`,
`.public-hard-shadow` `6px`, `.ceo-dialog` `8px`, dan ada 28 nilai
`shadow-[…]` arbitrer yang melewati semuanya.

Karena itu `BRAND` sengaja **tidak** punya field `border` atau `shadow`.
Offset hard-shadow yang ada di kode dibiarkan apa adanya; yang ditokenkan
hanya **warnanya** (`var(--color-border)`), karena warna sudah diputuskan
sedangkan offset belum. Field `shadow`/`shadowPressed` yang ada sebelumnya di
`BRAND` dihapus: tidak ada konsumennya, dan isinya mengarang keputusan yang
belum diambil.

Tanyakan ke pemilik, lalu tambahkan di `BRAND` pada commit yang sama dengan
perubahan deklarasi border dan shadow.

## Konsekuensi

1. **Semua nilai Tailwind arbitrer di scope publik hilang.** 208 nilai
   `[#hex]` menjadi kelas token: `bg-brand-primary`, `text-brand-ink`,
   `border-brand-ink`, dan seterusnya.
2. **Kontras beberapa pasangan membaik.** Violet `#8B5CF6` di atas putih
   bernilai 3.9:1 dan gagal WCAG AA untuk teks kecil; digantikan
   `--brand-primary-strong` yang 6.7:1. Istian hero
   `text-transparent` yang dulu mengandalkan gradient sekarang punya warna
   yang terukur.
3. **Superficie marketing dan dashboard sekarang benar-benar satu palet.**
   `--background` dashboard dan permukaan kartu marketing sama-sama biru pucat
   atau putih; sebelumnya marketing memakai warm-white dan cream.
4. **Memasukkan PR guard baru.** `pnpm check:brand` gagal kalau warna brand
   yang dicabut muncul sebagai hex di `apps/web`/`packages`, atau kalau
   gradient muncul di luar `.checkerboard`. Keduanya sudah didemonstrasikan
   gagal pada masukan buruk dan hijau pada masukan baik.
5. **Satu kegagalan kontras yang sudah ada sebelumnya ditemukan saat sapuan
   kontras, dan sengaja tidak diperbaiki di sini.** Memverifikasi 513 elemen
   teks di 9 rute (DOM hidup, bukan perkiraan) menemukan utility
   `text-[#16A34A]` pada label modul 12px di `/fitur` bernilai 3.3:1, di bawah
   ambang 4.5:1. Itu warna status **success**, bukan warna brand, dan sudah gagal
   sebelum ADR ini, jadi bukan regresi palet. Memperbaikinya berarti memutuskan
   masalah kontras warna status, yang di luar keputusan D-01. Dicatat di sini
   supaya tidak hilang, bukan diperbaiki diam-diam.
6. **Gradient tidak lagi tersedia sebagai alat.** Kalau suatu saat elemen
   butuh gradien, itu keputusan produk baru dan perlu ADR sendiri, bukan
   sekadar penambahan CSS.

## Migrasi default kiosk (terselesaikan saat review)

**Default kolom `kiosk_themes` di `packages/db/src/schema.ts` sudah diubah ke
ramp biru, DAN migrasinya sekarang ada:** `packages/db/migrations/0006_kiosk_theme_blue_defaults.sql`,
dijurnal sebagai idx 6, menetapkan ulang ketiga `DEFAULT` dan tidak menyentuh
baris lama.

Ini penting karena `kiosk-theme-server.ts` menyisipkan baris kiosk theme **tanpa**
warna (`values({ tenantId, boothId: null })`), jadi kolom DEFAULT itulah yang
benar-benar dirender kiosk untuk setiap tema baru. Tanpa migrasi, seluruh
deployment yang sudah ada akan tetap menyajikan tema kuning/violet meskipun
sumbernya sudah biru.

Catatan proses: migrasi dulu ditunda karena `scripts/migrate-ordered.mjs` mem-pin
`Drizzle 0000-0005` sementara ada pekerjaan 0005 yang belum selesai di repo.
Review menemukan bahwa konsekuensi menundanya adalah drift yang tidak terlihat
guard mana pun, jadi migrasi ditulis tangan dan pin runner dinaikkan ke
`0000-0006`. Snapshot `meta/` sengaja tidak disentuh: `drizzle-kit migrate`
hanya membaca jurnal dan berkas `.sql`, sedangkan `meta/*_snapshot.json` hanya
dipakai `generate`. Regenerasi snapshot akan menyerempet pekerjaan 0005 yang
sedang berjalan, jadi itu tetap tugas fase migrasi
(`pnpm --filter @snapbox/db generate`).

`packages/db/owner-migrations-invariants.test.mjs` sekarang memuat uji **D-01**
yang mengunci ketiganya sekaligus: skema memakai warna biru, baseline 0000
memang masih memuat warna lama (itu alasan migrasi ini ada), dan migrasi 0006
menyetel ulang ketiganya tanpa `UPDATE`. Drift schema-vs-migrasi sekarang gagal
di CI, bukan lolos senyap.

**Yang masih terbuka:** baris `kiosk_themes` yang **sudah ada** menyimpan warna
lamanya di kolom, dan tidak ikut berubah oleh DEFAULT baru. Kalau tema yang
sudah tersimpan harus ikut jadi biru, itu keputusan data (backfill) terpisah,
bukan bagian keputusan palet. Migrasi ini sengaja tidak memuat `UPDATE` supaya
tidak menimpa kustomisasi owner secara diam-diam.

## Alternatif yang ditolak

- **Opsi A, palet PRD menang.** Ditolak: Owner sudah menjawab, dan opsi B
  dipilih. Menulis ulang blok token dashboard plus semua permukaan turunan
  biru adalah pekerjaan besar tanpa hasil yang jelas.
- **Opsi C, palet ketiga yang tidak ada di kedua dokumen.** Ditolak: tidak
  perlu. Ramp biru sudah ada, sudah dipakai, dan sudah diuji lewat dashboard.
- **Jadikan satu guard allowlist penuh untuk semua hex.** Ditolak: daftar
  belanja warna akan menambah daftar belanja warna, dan setiap warna
  semantik yang sah (merah danger, hijau success, abu checkerboard) harus
  masuk daftar. Yang dijaga D-01 adalah warna **brand**, jadi itu yang dijaga.
- **Hapus checkerboard juga.** Pertanyaan itu diajukan ke pemilik dan
  jawabannya tidak: peta transparansi bukan gradient brand, dan PRD Task 2.5
  mewajibkannya.
- **Tulis `0006` untuk default `kiosk_themes` sekarang.** Ditolak, alasannya
  di bagian "Yang belum selesai".
