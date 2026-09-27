# ADR-019: Deploy Cloudflare Setelah Ruleset Diperbaiki ke Rute Nyata

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-12.
Tanggal: 2026-09-27.

## Konteks

`infra/cloudflare/README.md:6-7` menyatakan terus terang bahwa tidak ada
yang di direktori itu dieksekusi terhadap akun mana pun. Draft-nya **lengkap
tetapi tidak aktif**:

- 5 dari 8 aturan rate limit menargetkan endpoint yang **tidak ada**
  (`/api/payment/create`, `/api/contact`, `/api/operator/*`,
  `/api/pairing/*`, dan `/api/booth/*` yang diblokir flag
  `$requiresWorker` tanpa Worker di repo).
- **Prosedur verifikasi milik README sendiri** meng-curl `/api/contact` dan
  mengharapkan 429 yang tidak akan pernah datang.
- Kunci Turnstile dideklarasikan dan dipakai **nol kali**.

Sementara itu satu-satunya rate limit yang benar-benar jalan adalah
in-memory, per-instance, dapat dipalsukan lewat `x-forwarded-for` yang
berputar, dan **dapat dihapus secara global**.

## Bukti runtime (2026-09-27)

Menjalankan modul `rate-limit.ts` yang asli:

```
1) victim 10.0.0.9, 10 permintaan  -> allowed=true
2) request ke-11                   -> allowed=false, retryAfter=60s  (DIBLOKIR)
3) satu penyerang.insert 5000 kunci
4) victim coba lagi, IP sama       -> allowed=true                  (DIBLOKIRAN HILANG)

 kontrol: victim baru 10.0.0.8 setelah 10 permintaan -> allowed=false
```

**Terkonfirmasi.** Satu client bisa menghapus setiap counter orang lain, dan
auth brute force jadi tidak terbatas. D-12 stopk ini bukanSeq quality
practice; ini satu-satunya lapisan yang tidak bisa dilewati client.

## Keputusan

1. **Deploy edge protection**, karena lapisan aplikasi terbukti dapat
   dilewati. Ini satu-satunya perbaikan yang menutup kelas serangan ini.
2. **Tapi ruleset harus diperbaiki lebih dulu** ke kumpulan endpoint yang
   benar-benar ada. Aturan untuk `/api/payment/create`, `/api/contact`,
   `/api/operator/*`, `/api/pairing/*`, dan `/api/booth/*` **dihapus**
   sampai rute itu benar-benar ada. Aturan untuk `$requiresWorker`
   ditunda sampai Worker ada.
3. **Prosedur verifikasi README ditulis ulang** agar menguji rute yang ada
   (`/api/auth/session`, `/login`) dan **gagal** kalau tidak melihat 429.
   Verifikasi yang bisa gagal tanpa mengubah apa pun adalah verifikasi
   yang tidak memverifikasi apa pun.
4. `check:infra-drafts` **tidak lagi** memvalidasi ruleset terhadap PRD
   allowlist saja. Ia harus memvalidasi terhadap **rute yang benar-benar ada
   di `app/`**. Ketidakcocokan endpoint adalah CI failure.
5. **Turnstile:** widget dipasang hanya pada endpoint yang sudah ada. Kalau
   belum ada yang memakainya, hapus deklarasinya daripada membiarkan nol
   pemakaian.
6. Independen dari semua itu, **`rate-limit.ts` dalam aplikasi tidak boleh
   menjadi satu-satunya lapis**an, dan MAX_BUCKETS 5000 yang menghapus
   seluruh tabel harus diganti per-key eviction.

## Konsekuensi

- Menutup B-37, B-38.
- Memerlukan akun Cloudflare dan zone nyata. Ini satu-satunya keputusan di
  register ini yang butuh eksternal vendor.
- Aturan yang dihapus harus ditambahkan kembali saat rutenya ada. Itu
  impeks yang baik: ruleset akan gagal CI kalau ia menulis aturan untuk rute
  yang tidak ada.
- Menanamkan satu-satunya lapis yang tidak bisa dilewati client
