# Cloudflare Edge Protection SnapBox (DRAFT)

Artefak di direktori ini adalah **draf deklaratif dan runbook**, bukan konfigurasi
aktif. Ditulis untuk Task 0.6 sesuai PRD Bab 8.2 (rate limit per endpoint),
Bab 8.4 (arsitektur Cloudflare) dan Bab 10.5 (identitas per device/tenant).
Tidak ada satu pun berkas di sini yang dieksekusi terhadap akun Cloudflare:
tidak ada API token, tidak ada Zone ID, tidak ada perubahan dashboard.

## Tujuan

- Menyimpan rencana rate limit dan WAF sebagai berkas yang bisa
  di-review, di-diff, dan diterapkan ulang secara deterministik.
- Menyediakan runbook penerapan, verifikasi, dan rollback supaya penerapan
  nanti tidak bergantung pada ingatan operator.
- Menandai bagian yang butuh komponen lain (Transform Rule, Worker, Workers KV)
  agar tidak dikira sudah beres.

Berkas:

| Berkas                          | Isi                                                                          | Target endpoint API                                                       |
| :------------------------------ | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------ |
| `rate-limit-rules.json`         | 4 aturan rate limit, semuanya `ip.src` dan semuanya bisa cocok               | `PUT /zones/{zone_id}/rulesets/{id}` phase `http_ratelimit`               |
| `waf-custom-rules.json`         | Managed ruleset + 4 custom rule                                              | `PUT /zones/{zone_id}/rulesets/{id}` phase `http_request_firewall_custom` |
| `workers/rate-limit-counter.md` | Draf desain Worker + Workers KV untuk header identitas (DRAFT, belum dibuat) | Task 7.1                                                                  |

## Prasyarat

- `CLOUDFLARE_API_TOKEN` dengan scope minimum:
  - `Zone:Read`
  - `Zone WAF:Edit`
  - `Zone Settings:Edit`
- `CLOUDFLARE_ZONE_ID` = Zone ID untuk `snapbox.id` (sudah ada di daftar env,
  jangan buat env var baru).
- `wrangler` versi 3+ dan/atau `curl` + `jq`.

Aturan rate limit Cloudflare memakai **Rulesets API**, bukan endpoint rate limit
lama. Ruleset untuk rate limit ber-phase `http_ratelimit`; ruleset WAF kustom
ber-phase `http_request_firewall_custom`. Keduanya berupa ruleset zona.

## Cara Menerapkan

Ambil ID ruleset lebih dulu; bila belum ada, buat ruleset kosong pada phase yang
tepat. Semua perintah di bawah bersifat contoh dan belum pernah dijalankan.

### 1. Lihat ruleset yang ada

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets" | jq
```

### 2. Rate limit (`phase: http_ratelimit`)

Bungkus `rules` dari `rate-limit-rules.json` menjadi body ruleset. Field
`$comment`, `$requiresTransform`, dan `$requiresWorker` adalah metadata untuk
manusia dan **harus dibuang** sebelum dikirim (Cloudflare akan menolak field
tak dikenal).

```bash
jq -n --slurpfile f infra/cloudflare/rate-limit-rules.json \
  '{name:"SnapBox rate limit", kind:"zone", phase:"http_ratelimit", rules:($f[0].rules | map(del(."$comment","$requiresTransform","$requiresWorker")))}' \
  > /tmp/ratelimit-ruleset.json

# buat baru
curl -s -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets" \
  --data @/tmp/ratelimit-ruleset.json | jq

# atau perbarui ruleset yang sudah ada (ganti {ruleset_id})
curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/{ruleset_id}" \
  --data @/tmp/ratelimit-ruleset.json | jq
```

### 3. WAF kustom (`phase: http_request_firewall_custom`)

`managedRules` bukan bagian ruleset kustom; aktifkan lewat fase managed
(`http_request_firewall_managed`) di dashboard atau API terpisah. Untuk ruleset
kustom, ambil hanya `customRules`:

```bash
jq -n --slurpfile f infra/cloudflare/waf-custom-rules.json \
  '{name:"SnapBox WAF custom", kind:"zone", phase:"http_request_firewall_custom", rules:($f[0].customRules | map(del(."$comment")))}' \
  > /tmp/waf-ruleset.json

curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/{ruleset_id}" \
  --data @/tmp/waf-ruleset.json | jq
```

### 4. Dengan `wrangler`

`wrangler` tidak punya perintah native untuk ruleset WAF/rate limit; gunakan
`wrangler` untuk autentikasi zona lalu `curl` seperti di atas, atau simpan token
sebagai secret. Contoh memastikan zona dan akun:

```bash
pnpm dlx wrangler whoami
pnpm dlx wrangler zones list
```

### 5. Turnstile — SENGAJA TIDAK ADA (2026-09-27, D-12)

Draf widget Turnstile dan deklarasi env-nya **dihapus**, bukan ditulis ulang.
Alasannya, dan ini yang perlu diketahui kalau nanti ditanya lagi:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` dideklarasikan
  tetapi **nol pemakai di seluruh aplikasi** — tidak ada satu pun endpoint yang
  memanggil siteverify. Widget hanya bisa diterbitkan di akun Cloudflare nyata,
  dan widget itu tidak pernah dibuat, jadi secret-nya tidak pernah ada.
- Memasang widget tanpa secret yang sebenarnya tidak menambah keamanan:
  endpoint yang tidak memverifikasi token sama sekali tetap terbuka.
- Yang tersisa kalau deklarasi dibiarkan adalah inventaris env yang menyatakan
  ada lapisan bot protection yang tidak ada. Itu lebih buruk dari tidak ada,
  karena pemeriksaan keamanan membaca inventaris dan menyimpulkan ada kontrol.

**Bot protection yang benar-benar aktif** setelah draf ini di-deploy adalah
`botFightMode` di `waf-custom-rules.json` (mode `bot_fight_mode`). Kalau paket
zona naik ke yang mendukung Super Bot Fight Mode, ganti ke SBFM dengan
`definitely-automated = block` dan catat perubahannya di sini.

Untuk memasang Turnstile nanti, syaratnya bukan "ingin" melainkan: ada endpoint
`/api/auth/*` yang memanggil `siteverify` lebih dulu, dan widget asli di akun
Cloudflare. Tambahkan kedua env var saat itu juga.

## DNS Pointing

`snapbox.id` diarahkan ke Vercel dengan proxy Cloudflare aktif.

- CNAME `@` → `cname.vercel-dns.com`, proxy **ON** (orange cloud).
- CNAME `www` → `cname.vercel-dns.com`, proxy **ON** (orange cloud).
- SSL/TLS mode: **Full (Strict)** sesuai PRD Bab 8.4. Mode `Full` tanpa
  `Strict` **dilarang** karena tidak memverifikasi sertifikat origin Vercel.
- Always Use HTTPS: aktif. Minimum TLS 1.2.

Verifikasi:

```bash
dig +short snapbox.id @1.1.1.1
dig +short www.snapbox.id @1.1.1.1
curl -sI https://snapbox.id | grep -i -E "server|cf-ray|strict-transport-security"
```

`server: cloudflare` dan adanya `cf-ray` menandakan trafik melewati proxy
Cloudflare. Cek juga `ssl` mode:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/ssl" | jq '.result.value'
# harapan: "strict"
```

## Verifikasi

Semua perintah di bawah memakai path yang **benar-benar ada** di
berkas `route.ts` di bawah `apps/web/src/app/api/`. Versi lama memakai endpoint
form kontak yang tidak pernah ada, sehingga runbook melaporkan 404 sebagai
"tidak kena rate limit" — negatif palsu yang terlihat seperti konfigurasi yang
benar. `pnpm check:infra-drafts` kini
menolak draf maupun README yang menyebut path yang tidak ada.

Rate limit auth (10/menit per IP, path nyata `/api/auth/session`):

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://snapbox.id/api/auth/session \
    -H 'content-type: application/json' -d '{}'
done
# harapan: 400 (body tidak valid) untuk 10 pertama, lalu 429
```

Rate limit booth (60/menit per IP, path nyata `/api/booth/heartbeat`):

```bash
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://snapbox.id/api/booth/heartbeat \
    -H 'content-type: application/json' -d '{}'
done
# harapan: 400 untuk 60 pertama, lalu 429
```

Webhook (happy path wajib tetap lolos; 300/menit per IP, path nyata
`/api/webhooks/pakasir-b2b`):

```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://snapbox.id/api/webhooks/pakasir-b2b \
    -H 'content-type: application/json' -d '{}'
done
# harapan: 401 (signature tidak valid) untuk semua — 401 BUKAN 429, itu artinya
# rate limit tidak menahan trafik webhook yang sah.
```

Cara membaca hasil: `429` berarti rule bekerja. `400`/`401` berarti request
menembus sampai origin dan ditolak di aplikasi — juga benar, selama jumlahnya
sesuai plafon.

WAF (termasuk Bot Fight Mode):

- Dashboard → **Security → Events** menampilkan aksi tiap rule (block, managed
  challenge, skip) beserta rule id dan IP.
- Filter `Action = Block` untuk memastikan WAF menangkap payload SQLi/XSS uji.
- Pastikan `/monitoring-tunnel` dan `/api/health` berstatus **skip**: panggil
  `curl -sI https://snapbox.id/api/health` beberapa kali cepat, harus selalu
  bukan 429 dan tanpa challenge.
- Rate limit dapat juga dilihat di **Security → Events** dengan filter
  `Source = Rate limit`.

Kalau `curl` mengembalikan 429 lebih cepat dari perkiraan, cek apakah ada rule
per-IP lain (contact satu jam) yang ikut terhitung.

## Rollback

- **Kembalikan versi sebelumnya**: setiap PUT pada ruleset membuat versi baru;
  ambil daftar versi dan PUT ulang versi lama.

  ```bash
  curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rulesets/{ruleset_id}" | jq '.result.version'
  ```

- **Matikan tanpa hapus**: set `enabled: false` pada rule (`customRules`) atau
  set `action` menjadi `log` pada rate limit, lalu PUT ulang. Ini langkah paling
  aman saat produksi: rule tetap ada untuk didiff, tapi tidak menahan trafik.
- **Hapus ruleset**: `DELETE /zones/{zone_id}/rulesets/{ruleset_id}`. Lakukan
  hanya bila seluruh blok memang mau dilepas.
- **DNS**: kembalikan CNAME atau matikan proxy (grey cloud) bila perlu
  menonaktifkan seluruh jalur Cloudflare.

Setelah rollback, jalankan ulang langkah **Verifikasi** untuk memastikan trafik
kembali normal.

## Batasan

| Batasan                                                    | Detail                                                                                                              | Dikerjakan di         |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :-------------------- |
| Tidak ada eksekusi                                         | Semua berkas DRAFT; tidak ada token/zone id yang dipasok ke sini.                                                   | Task penerapan Fase 8 |
| Karakteristik email (`auth-5-per-min-per-email`)           | Email ada di body, bukan header; butuh Transform Rule `http_request_transform` yang menyalinnya ke header.          | Task penerapan Fase 8 |
| Rule `$requiresWorker` (booth, payment, operator, pairing) | Butuh Worker yang menyuntik `x-device-fingerprint`, `x-booth-id`, `x-tenant-id`.                                    | Task 7.1              |
| Counter Workers KV                                         | Draf desain di `workers/rate-limit-counter.md`; KV eventually consistent sehingga best-effort.                      | Task 7.1              |
| `/api/sentry-example`                                      | Rute sementara; pengecualian di WAF harus dihapus saat rute dihapus.                                                | Task 0.6 lanjutan     |
| Turnstile                                                  | Dihapus 2026-09-27 (D-12): nol pemakai, tidak ada widget, tidak ada env var. Bot protection memakai Bot Fight Mode. | —                     |

Draf ini WAJIB ditinjau ulang terhadap PRD Bab 8.2 setiap kali PRD berubah:
angka per endpoint, daftar path, dan dimensi identitas bisa bergeser. Skrip
`pnpm check:infra-drafts` memvalidasi berkas di direktori ini: ketiga
berkas JSON ter-parse, `README.md` ada, setiap path `/api/...` di
`rate-limit-rules.json` menunjuk path yang benar-benar ada di
`apps/web/src/app/api/`, setiap path di `README.md` juga ada, tidak ada aturan
yang ditandai `$requiresWorker`/`$requiresTransform`, tidak ada karakteristik
berbasis header, dan setiap rule punya nama unik yang tidak kosong. Skrip ini TIDAK memeriksa ambang angka
(300/min, 10/min, dan seterusnya) maupun konsistensi daftar pengecualian
WAF (`/monitoring-tunnel`, `/api/health`, `/api/sentry-example`),
yang tetap harus disinkronkan manual antara `waf-custom-rules.json` dan
`rate-limit-rules.json`;
jalankan skrip itu setelah mengubah PRD atau salah satu draf. Jika skrip
memberi peringatan, perbarui draf sebelum dipakai.
