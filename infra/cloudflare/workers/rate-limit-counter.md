# DRAF: Worker + Workers KV untuk Header Identitas Rate Limit

> **STATUS: DRAFT.** Dokumen desain saja. Tidak ada Worker, KV namespace,
> binding, `wrangler.toml`, atau rute yang dibuat. Implementasi nyata milik
> **Task 7.1**; berkas ini hanya mengikat kontrak header yang dipakai
> `rate-limit-rules.json`.

## Masalah

PRD Bab 8.2 meminta rate limit per device fingerprint, per booth, dan per
tenant. Cloudflare Rate Limiting hanya bisa karakteristik berdasarkan hal yang
terlihat di request: `ip.src`, `cf.colo.id`, dan header. Cloudflare tidak melihat
`device_id`, `booth_id`, ataupun `tenant_id` karena nilai itu tidak dikirim
sebagai header oleh klien. Jadi header harus dipasang lebih dulu oleh Worker.

PRD Bab 8.4 menegaskan identitas device = `device_id` + `tenant_id` + IP +
credential + endpoint, bukan IP saja (karena NAT membuat banyak device berbagi
satu IP). Header dari Worker inilah cara menegakkan itu.

## Header kontrak

Worker menyuntik header berikut sebelum meneruskan request ke origin:

| Header                 | Sumber                                                                | Dipakai rule                              |
| :--------------------- | :-------------------------------------------------------------------- | :---------------------------------------- |
| `x-device-fingerprint` | fingerprint device dari sesi Tauri / pairing record                   | `booth-60-per-min-per-device-fingerprint` |
| `x-booth-id`           | booth aktif milik sesi                                                | `payment-create-...`, `operator-...`      |
| `x-tenant-id`          | tenant dari klaim sesi (server-side, bukan input klien — PRD Bab 5.5) | `pairing-10-per-min-per-tenant`           |
| `x-auth-email`         | email dari body `/api/auth/*` (via Transform Rule, bukan KV)          | `auth-5-per-min-per-email`                |

Header yang sudah dipasang klien harus **ditimpa**, bukan dibiarkan: Worker
menghapus nilai masuk lalu menulis nilai hasil verifikasi sendiri supaya klien
tidak bisa memalsukan identitas dan menghindari rate limit.

## Bentuk kunci KV

Counter disimpan di Workers KV, satu kunci per (dimensi, identitas, jendela
waktu). Jendela waktu dibulatkan ke satuan periode (menit), sehingga kunci
otomatis berganti tiap periode dan tidak perlu pembersihan manual.

```
rl:device:{fingerprint}:{minute}      contoh: rl:device:fp_9f2a:29384756
rl:booth:{booth_id}:{minute}          contoh: rl:booth:booth_12:29384756
rl:tenant:{tenant_id}:{minute}        contoh: rl:tenant:tenant_3:29384756
```

- `minute` = `Math.floor(Date.now() / 60000)`. Untuk periode 3600 detik
  (endpoint `/api/contact`, tetapi contact memakai IP langsung sehingga tidak
  lewat KV), pakai pembagi yang sesuai.
- Nilai kunci = integer count sebagai string.
- TTL = periode. Tulis dengan `expirationTtl` sama dengan `period` rule yang
  bersangkutan (60 detik untuk sebagian besar rule) supaya kunci kedaluwarsa
  sendiri. Tambahkan sedikit margin (mis. TTL = period + 10) agar jendela di
  tepi menit tidak terhapus sebelum rule sempat membacanya.

Contoh tulis:

```ts
await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 70 });
```

## Caveat atomisitas

**Workers KV tidak atomik.** Operasi `get` lalu `put` bisa balapan (read-modify-
write), dan KV hanya eventually consistent: tulisan mungkin belum terlihat di
colo lain. Akibatnya:

- Counter ini **best-effort**, bukan jaminan tepat. Di bawah konkurensi tinggi
  atau trafik lintas colo, hitungan bisa kurang dari sebenarnya sehingga sedikit
  request bisa lolos.
- Untuk penegakan **tepat**, alternatifnya **Durable Object** per identitas
  (satu titik serialisasi `get`/`put`) atau Rate Limiting API bawaan Cloudflare
  bila binding per-zone tersedia.

Keputusan: tetap pakai KV untuk Task 7.1 karena murah, sederhana, dan ini lapisan
tambahan di atas rate limit `ip.src` yang sudah ada; jangan mengandalkan KV
sebagai satu-satunya pertahanan. Bila ternyata ada endpoint yang butuh batas
ketat, endpoint itu naik ke Durable Object.

## Tanggung jawab Task 7.1

Task 7.1 (bukan Task 0.6) yang memiliki:

- Pembuatan Worker, KV namespace, binding, dan rute.
- Verifikasi tanda tangan sesi sehingga `x-tenant-id` dan `x-booth-id` berasal
  dari klaim tepercaya, dan penimpaan header klien.
- Pemilihan akhir antara KV dan Durable Object per endpoint.
- Pengujian bahwa `rate-limit-rules.json` benar-benar cocok dengan header yang
  disuntik.

## Batasan draf

- Tidak ada kode yang dijalankan, tidak ada namespace dibuat.
- Nama kunci dan skema header adalah kontrak awal; boleh berubah saat Task 7.1
  mulai, tetapi `rate-limit-rules.json` harus ikut diperbarui agar tetap cocok.
