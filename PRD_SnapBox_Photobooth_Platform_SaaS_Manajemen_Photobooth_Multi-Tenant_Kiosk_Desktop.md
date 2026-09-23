# SnapBox Photobooth — Platform SaaS Manajemen Photobooth Multi-Tenant & Kiosk Desktop

---

## 1. Ringkasan & Tujuan Aplikasi
*Bagian ini menjelaskan gambaran umum proyek agar dipahami bersama oleh pemilik ide/klien dan tim pengembang.*

- **Nama Aplikasi**: SnapBox Photobooth — Platform SaaS Manajemen Photobooth Multi-Tenant + Desktop Kiosk Application
- **Penjelasan Singkat**: SnapBox adalah platform SaaS all-in-one (infrastructure + operating system) untuk bisnis photobooth yang menghubungkan Super Admin, Owner/Tenant, Outlet, Booth fisik, dan Customer — mengendalikan seluruh siklus hidup mesin photobooth secara real-time dari cloud, sementara aplikasi desktop Tauri v2 mengeksekusi hardware (DSLR/mirrorless Canon/Nikon/Sony + webcam, printer DNP/Epson/Canon) secara lokal dengan fallback offline yang aman.
- **Visi Produk**: Menjadi "AWS-nya industri photobooth" — infrastruktur + sistem operasi yang membuat 1 booth bisa scale ke 1.000+ booth tanpa menambah kompleksitas operasional. Fokus nilai:
  - **Zero-touch operation**: seluruh konfigurasi harga, frame, tema, promo, dan printer diubah dari web — tanpa perlu ke lokasi.
  - **Hardware-first**: mendukung DSLR/mirrorless profesional, bukan hanya webcam.
  - **Server as source of truth**: kiosk tidak pernah memalsukan status PAID.
  - **Graceful degradation**: internet mati ≠ fotografer tidak bisa jalan.
  - **Multi-tenant isolation**: setiap tenant benar-benar terisolasi (RLS + ownership validation).
- **Masalah yang Diselesaikan**:
  - Pemilik photobooth harus datang ke lokasi hanya untuk mengubah harga, frame, atau memonitor stok kertas.
  - Tidak ada sistem terpusat untuk mengelola banyak booth yang tersebar (mall, wisata, event).
  - Payment manual (tunai/QRIS statis) rawan kebocoran pendapatan dan tidak bisa diskalakan.
  - Frame foto umumnya hardcoded — sulit dikustomisasi tanpa jasa programmer.
  - Tidak ada jejak digital (soft copy JPG mentah + frame + GIF) ketika pelanggan kehilangan struk fisik.
  - Hardware mahal (DSLR/mirrorless) tidak bisa dipakai karena software kiosk hanya support webcam.
  - Tidak ada sistem add-on device yang fleksibel (pairing/revoke) sesuai pertumbuhan bisnis.
  - Tidak ada kontrol terpusat (Super Admin) untuk mengatur seluruh tenant, harga plan global, add-on, promo platform-wide, dan audit trail.
  - Kiosk rentan di-tamper pengunjung (Alt+F4, Windows key, gesture exit) — tidak ada lockdown layer yang aman.
- **Pengguna Aplikasi & Kebutuhan Utama**:
  - **Super Admin / CEO**: kontrol penuh seluruh tenant, harga plan global, MRR, suspend/ban, promo global, add-on, audit trail, broadcast.
  - **Owner (Tenant)**: mengelola booth, pairing/revoke device, frame studio + chroma key, kiosk theme, promo/voucher, staff, payment gateway, outlet, package, template, dan analytics pendapatan.
  - **Staff / Technician**: monitoring read-only booth yang ditugaskan via QR LAN + PIN operator, troubleshooting cepat, akses diagnostik terbatas.
  - **Customer (End User)**: menjalankan sesi foto — pilih paket, bayar (tunai/voucher/QRIS), pose, retake, filter, composite ke frame, cetak, dan unduh soft copy (raw JPG + framed JPG + GIF) via QR.
  - **Device (Tauri Kiosk)**: identitas mesin yang diautentikasi via secure pairing, menjalankan heartbeat, menerima config realtime, dan mengeksekusi hardware.
- **Model Bisnis (Ringkas)**:
  - SaaS multi-tier: Starter Rp 100.000/bln, Growth Rp 180.000/bln, Enterprise Rp 250.000/bln.
  - Add-on device Rp 99.000/device/bln, Extra Storage, Extra Frame Slot.
  - Billing B2B otomatis via **Pakasir** + webhook HMAC-SHA256.
  - B2C payment gateway per-tenant: **Midtrans, Xendit, Doku, Pakasir** (dikonfigurasi sendiri oleh Owner via docs masing-masing provider, kredensial terenkripsi AES-256-GCM).
- **Target Keberhasilan (KPI Terukur)**:
  - Pairing device baru < 2 menit; revoke device kapan saja berhasil dalam < 5 detik.
  - Chroma key + composite + filter + upload < 2 detik.
  - Payment success rate > 95% dengan handling webhook idempotent di semua gateway.
  - API P95 < 200ms; Webhook P95 < 500ms; Realtime event < 2 detik.
  - Sistem melayani 1.000 booth aktif secara simultan dengan isolasi tenant 100% teruji.
  - Subscription renewal rate > 85% untuk Growth & Enterprise.
  - Zero cross-tenant data leak (IDOR test suite lulus 100%).

---

## 2. Batasan Pembuatan Sistem (Versi Awal MVP)
*Menegaskan fitur apa yang dikerjakan di versi awal dan apa yang sengaja ditunda agar aplikasi cepat selesai dan tidak membengkak.*

### ✅ Yang Dikerjakan (MVP Scope):
- Public website anti-slop (Beranda, Tentang, Fitur, Harga, Kamera, Kontak, Docs Troubleshooting, Unduh Aplikasi).
- Autentikasi Firebase Email & Password berbasis undangan (tanpa self-registration) untuk CEO/Owner/Staff, dengan custom claims (`CEO`, `OWNER`, `STAFF`, `tenant_id`).
- Multi-tenant SaaS 3 tier + add-on device (Rp 99k), extra storage, extra frame slot.
- Subscription engine lengkap: plan, pricing engine, proration, renewal, grace period, expiry, suspend, reactivate.
- Feature Entitlement System (bukan pengecekan hardcoded `plan === "GROWTH"`).
- Super Admin Dashboard lengkap: tenant CRUD, subscription global, plan editor, broadcast, audit log, devices monitor, promo global, settings.
- Owner Dashboard lengkap: outlets, machines, pairing/revoke, frame studio + chroma key, templates, packages, kiosk theme customizer, promo & voucher, payment gateway config, staff, customers, transactions, finance, analytics, reports, subscription, notifications, settings, global search.
- Staff Dashboard (read-only monitoring).
- Device Console (Web + Tauri): Status, Diagnostics (Kamera, Printer, Panel Operator, Sistem, Riwayat & Log), kamera troubleshooting wizard, printer diagnostics, system tab, orientation, kiosk style.
- Secure Device Pairing: QR + kode 6-digit dengan short-lived pairing token, device fingerprint, one-time credential exchange, revocable.
- Tauri Desktop App (Windows NSIS + Linux .deb): Attract Mode, Pre-Payment Guide, Package Selection, Voucher Input + Virtual Keyboard, Payment Screen, Capture, Filters & Adjust, Retake, Chroma Key Composite, Auto Print, QR Soft Copy.
- Hardware Abstraction Layer: `CameraAdapter`, `PrinterAdapter`, `StorageAdapter`, `PaymentAdapter`, `DeviceAdapter`.
- Camera support: Canon EDSDK, Nikon PTP, Sony Camera Remote SDK, Webcam (compatibility matrix publik di `/kamera`).
- Printer support: Windows Spooler, DNP, Epson, Canon dengan paper profile.
- Fullscreen kiosk lockdown (application-level) + PIN Lock Mode saat capture.
- Chroma key presisi dengan color picker (delta RGB) + multi-layer (Enterprise).
- Frame Studio: upload, chroma color picker, tolerance, assign ke booth, versioning, retention.
- Kiosk Theme Engine: logo, warna, font, welcome text, CTA, attract mode, panel style (Classic/Card/Receipt), orientation, PIN Lock toggle, version history.
- Promo & Voucher engine: percentage/fixed, minimum purchase, quota, per-customer limit, batch generate, atomic redemption lock.
- Multi-provider Payment B2C: Midtrans (default), Xendit, Doku, Pakasir — via `PaymentProvider` interface, kredensial terenkripsi.
- Multi-provider Payment B2B: Pakasir webhook HMAC-SHA256.
- Realtime sync: Supabase Realtime channel `booth:{boothId}`, `user:{userId}`, `tenant:{tenantId}`.
- In-App Realtime Notification: low paper, booth offline, subscription expiring, payment paid, printer error, device paired/revoked.
- Cloudflare protection: DNS, CDN, WAF, Rate Limiting, Turnstile, Bot Protection.
- Observability: Sentry, structured logging, health check `/api/health`, Supabase pg_cron untuk subscription expiry & cleanup.
- Audit trail immutable (`activity_logs`) untuk aksi kritis.
- PWA installable untuk dashboard tablet.
- Data retention sesuai plan (Starter 30 hari, Growth 90 hari, Enterprise 365 hari).
- SEO dinamis + JSON-LD + sitemap + robots.
- Testing: unit, integration, E2E (Playwright), security, load, chaos.
- CI/CD: GitHub Actions untuk web (Vercel) + Tauri (Windows NSIS, Linux .deb via release GitHub).

### ⛔ Yang Tidak Dikerjakan di Versi Awal (Non-Goals):
- Mobile native app (iOS/Android) untuk Owner/Staff.
- Self-registration publik untuk Owner (wajib invite dari Super Admin).
- Multi-currency (MVP hanya IDR).
- AI auto-enhancement foto (MVP hanya preset filter + custom LUT basic).
- Marketplace frame publik antar-tenant.
- Hardware fingerprint / NFC identification.
- Integrasi printer thermal struk kasir (kecuali panel style "struk" untuk tampilan kiosk saja).
- Multi-language UI kiosk penuh (MVP: Bahasa Indonesia default + English toggle pada strings dasar).
- Real-time collaborative editing frame antar-staff.
- White-label per tenant dengan custom domain.
- Reseller / Franchise / Regional Manager / Support Agent role (arsitektur future, tidak diaktifkan MVP).
- Sistem pembayaran offline (tunai tetap diizinkan bila tercatat via staff, tapi status PAID selalu server-authoritative).
- Marketplace add-on pihak ketiga.

---

## 3. Daftar Halaman & Struktur Menu (Pages & Routing)
*Daftar lengkap halaman yang dikelompokkan berdasarkan area atau peran pengguna.*

### A. Public Area (Tanpa Login)
- `/` (Beranda): Hero besar neobrutalism dengan stagger text, showcase frame, 3 paket harga, logo tenant marquee, testimoni, FAQ accordion, CTA "Konsultasi Gratis" via WhatsApp, footer border 4px.
- `/tentang` (Tentang Kami): Cerita SnapBox, visi misi, tim, statistik platform dengan counter animasi.
- `/fitur` (Fitur): Modul Machine Manager, Frame Studio, Chroma Key, Promo Engine, Kiosk Customizer, Analytics — dengan mockup visual.
- `/harga` (Harga & Paket): Tabel 3 tier + matriks perbandingan fitur + info add-on device Rp 99k. Tombol "Konsultasi" (bukan self-checkout).
- `/kamera` (Dukungan Kamera): Daftar 145+ kamera (Canon/Nikon/Sony) dengan filter model/brand/status/tether, troubleshooting, FAQ.
- `/kontak` (Kontak): Info sales, alamat, form pesan non-auth (Resend) + Cloudflare Turnstile, jam operasional, peta.
- `/docs/troubleshooting` (Troubleshooting): Panduan 6 langkah mendeteksi kamera (USB data, mode PTP, tutup utility bawaan, JPEG L, auto power off, USB power supply Sony).
- `/login` (Login): Halaman login Email & Password neobrutalism untuk CEO, Owner, Staff (dengan mode PIN/kode untuk jalur khusus).
- `/unauthorized` (Akses Ditolak): 403 dengan tombol kembali ke login.
- `/unduh-aplikasi` (Unduh Desktop App): Installer Windows `.exe` (NSIS) + Linux `.deb` + changelog + minimum hardware + tombol "Buka Konsol Perangkat (Web)".
- `/download/[token]` (Ambil Soft Copy): Halaman publik via QR — validasi token 7 hari + single-use, menampilkan raw JPG + framed JPG + GIF.
- `/legal/privacy` & `/legal/terms`: Kebijakan privasi & ToS.

### B. Super Admin / CEO Area (Setelah Login)
- `/ceo-dashboard` (Dasbor Utama): Metrik besar (Total Tenant, Active Booths, MRR, Churn), grafik pertumbuhan, recent events, alert sistem.
- `/ceo-dashboard/tenants` (Manajemen Tenant): Tabel tenant + filter status/plan + search (kolom: Company, Owner Email, Plan, Status, Last Seen).
- `/ceo-dashboard/tenants/new` (Wizard Tenant Baru): Wizard 3 langkah (Client Details → Plan & Duration → Review & Invite).
- `/ceo-dashboard/tenants/[id]` (Detail Tenant): Profil, riwayat langganan, booth, aktivitas, tombol suspend/ban/reset/downgrade/restore.
- `/ceo-dashboard/subscriptions` (Langganan Global): Semua invoice Pakasir B2B + filter status + retry invoice gagal.
- `/ceo-dashboard/plans` (Kelola Harga & Fitur Plan): Editor harga/limit/fitur per plan, harga add-on.
- `/ceo-dashboard/devices` (Monitor Device Global): Semua device Tauri lintas tenant + status + versi + OS + IP + heartbeat.
- `/ceo-dashboard/broadcast` (Broadcast): Kirim notifikasi realtime ke semua/tenant terpilih.
- `/ceo-dashboard/activity-log` (Audit Trail Immutable): Filter aktor/aksi/resource/tanggal.
- `/ceo-dashboard/promos` (Promo Global): Voucher platform-wide, aktif/nonaktif, kuota.
- `/ceo-dashboard/settings` (Pengaturan Global): WhatsApp sales, template email, SMTP, harga default, feature flag, API keys master, Cloudflare config.
- `/ceo-dashboard/system-health`: Status layanan (Supabase, Firebase, Cloudflare, gateway), queue webhook, cronjob.
- `/ceo-dashboard/security`: Log percobaan login gagal, rate limit hits, WAF events, session aktif.

### C. Owner Area (Setelah Login)
- `/owner-dashboard` (Dasbor Utama): Ringkasan mesin online/offline, revenue hari ini, alert stok kertas, chart 7 hari, quick action (add device, upload frame).
- `/owner-dashboard/outlets` (Outlet/Cabang): CRUD outlet (nama, alamat, koordinat, PIC).
- `/owner-dashboard/outlets/[id]`: Detail outlet + booth terhubung + sales per outlet.
- `/owner-dashboard/machines` (Machine Manager): Daftar booth status real-time + "Add New Device" (generate pairing code + QR) + status paper/lokasi.
- `/owner-dashboard/machines/[boothId]`: Konfigurasi harga per booth, paper count, maintenance mode, PIN Lock toggle, unpair/revoke, sessions, history.
- `/owner-dashboard/devices` (Device & Add-On Manager): Device paired, revoke, kuota add-on, renewal, tombol upgrade add-on.
- `/owner-dashboard/devices/[boothId]/diagnostics` (Konsol Perangkat Web): Entry ke 5 tab diagnostik.
- `/owner-dashboard/devices/[boothId]/diagnostics/kamera`: Scan + kalibrasi (mirror/rotasi/zoom) + troubleshooting wizard.
- `/owner-dashboard/devices/[boothId]/diagnostics/printer`: Pilih printer default, paper profile, test print, spooler status.
- `/owner-dashboard/devices/[boothId]/diagnostics/operator`: Generate QR operator, sesi operator aktif, tombol Disconnect/Revoke.
- `/owner-dashboard/devices/[boothId]/diagnostics/sistem`: Versi app, OS services, orientation, kiosk style, WIA conflict.
- `/owner-dashboard/devices/[boothId]/diagnostics/riwayat`: Sessions, application logs, hardware logs, sync history, print jobs, camera events.
- `/owner-dashboard/frame-studio`: Library frame + upload drag-drop + chroma picker + preview checkerboard + assign booth + versioning.
- `/owner-dashboard/templates`: Preset layout (single, strip 2x6, kolase 4-pose, custom) + preview + aktifkan.
- `/owner-dashboard/packages`: CRUD paket foto per booth + retake limit + pose + print size.
- `/owner-dashboard/kiosk-theme`: Editor kiosk (logo, warna, font, welcome, attract, CTA, panel style, orientation, PIN Lock) + live preview + version history.
- `/owner-dashboard/promos`: Voucher CRUD + batch generate + tracking redemption.
- `/owner-dashboard/payment-settings`: Provider B2C (Midtrans/Xendit/Doku/Pakasir), API Key + Secret encrypted, sandbox/production, primary/backup, test connection.
- `/owner-dashboard/staff`: CRUD staff + invite + permission read-only + deactivate + kuota staff.
- `/owner-dashboard/customers` (CRM): Customer unik + total foto + total belanja + last visit (masking untuk staff).
- `/owner-dashboard/transactions`: Tabel 100+ transaksi + filter + bulk ZIP + export CSV.
- `/owner-dashboard/finance`: Revenue harian/mingguan/bulanan + komisi gateway + breakdown per outlet/booth.
- `/owner-dashboard/analytics`: Line chart revenue (7/30), pie payment method, funnel conversion, retention.
- `/owner-dashboard/reports`: Report terjadwal (email) + export PDF/CSV.
- `/owner-dashboard/subscription`: Status Pakasir B2B, tanggal expired, tombol perpanjang, histori invoice, upgrade/downgrade, add-on.
- `/owner-dashboard/notifications`: Riwayat notif + mark as read.
- `/owner-dashboard/settings`: Profil, ganti password, zona waktu, template email internal, API keys devices.
- `/owner-dashboard/support`: Request support ticket minimal (form → email Resend).

### D. Staff Area (Setelah Login)
- `/staff-dashboard` (Dasbor Monitor): Ringkasan booth yang ditugaskan + alert low paper/offline + log hari ini.
- `/staff-dashboard/machines`: Tabel read-only booth + paper count + last heartbeat + lokasi + outlet.
- `/staff-dashboard/machines/[boothId]`: Read-only detail + action terbatas (test print, request pairing).
- `/staff-dashboard/notifications`: Notif tenant parent (read-only).
- `/staff-dashboard/profile`: Info akun, ganti password, riwayat login.

### E. Web Konsol Perangkat / Diagnostik (Akses dari Web, Read-Only Fallback)
- Akses utama via `/owner-dashboard/devices/[boothId]/diagnostics/*` (lihat Bab C).
- Bridge agent opsional mengizinkan monitoring terbatas saat device offline.

### F. Tauri Desktop Kiosk App (Fullscreen App, Bukan Route Web)
- **Attract Mode**: Video loop / slideshow foto (consent) + overlay "SENTUH UNTUK MULAI ✨" + tombol skip tersembunyi sudut kanan bawah.
- **Pre-Payment Guide**: 3 langkah (Pilih Paket → Bayar → Pose) + ilustrasi besar configurable Owner.
- **Package Selection**: Kartu paket dengan border tebal klik.
- **Voucher Input Screen**: Virtual keyboard numpad + alfanumerik (min 120×120px per tombol).
- **Payment Screen**: QRIS besar (countdown 5 menit) / instruksi tunai / konfirmasi voucher.
- **Camera Selection (Opsional)**: Dropdown webcam/DSLR terdeteksi (jika > 1).
- **Countdown Screen**: "3... 2... 1... SENYUM! 😁" dengan animasi besar.
- **Capture Screen**: Live preview + overlay frame + tombol capture besar + retake + selesai. **PIN Lock aktif mulai sini**.
- **Filter & Adjust Screen**: Grid filter preview + slider zoom/scale + drag position untuk match frame.
- **Review Screen**: Preview composite + Print atau Retake.
- **Processing Screen**: Progress bar + upload multi-format (raw JPG + framed JPG + GIF).
- **Print Screen**: Print progress + fallback error printer (NeoAlert merah).
- **Success Screen**: QR Code besar + tombol preview GIF + countdown auto-return ke Attract Mode.
- **Maintenance Mode**: Overlay penuh saat subscription expired (grace period habis).
- **Konsol Perangkat (Nested, via PIN admin)**: 5 tab lengkap (Status, Diagnostics: Kamera/Printer/Operator/Sistem/Riwayat & Log).
- **Boot Health Check Screen**: Checklist kesiapan kiosk (device auth, subscription, camera, printer, storage, config synced, theme loaded, package loaded).
- **Safe Recovery Screen**: Ditampilkan jika startup gagal (bukan langsung ke desktop Windows).

---

## 4. Pedoman UI/UX & Design System
*Panduan visual konkret agar AI coding assistant tidak membuat UI yang kaku atau default. Mengikuti skill anti-slop, taste, dan neobrutalism-components.*

### Filosofi Desain
- **Anti-AI-Slop**: Hindari layout generik "centered card + purple gradient + Inter tebal". Wajib hierarki visual tegas, border hitam tebal (3–4px), shadow keras (bukan blur), dan warna aksen neon yang disengaja.
- **Neobrutalism Authentic**: Base komponen dari `neobrutalism-components` (ekmas) — Box, Button, Card, Input, Tabs, Badge, Alert, Dialog, Table, Select, Accordion, Progress, Slider, Tooltip, DropdownMenu.
- **Taste-Driven Composition**: Setiap halaman punya "hero moment" khas (stagger text, marquee, sticky feature, editorial asymmetry). Proporsi whitespace 1:3 antara gap dan konten. Tidak semua section punya border tebal — hanya section kritis.
- **Contextual Density**: Landing = editorial; Dashboard = dense; Device Console = terminal-teknis; Kiosk = touch-first besar; Operator = cepat.

### Skema Warna (Neobrutalism Palette)
- **Primary (SnapBox Neon Yellow)**: `#FFDD00` — HSL(51, 100%, 50%) — CTA utama, badge aktif, highlight.
- **Secondary (Electric Violet)**: `#8B5CF6` — HSL(263, 90%, 65%) — aksen sekunder, gradient kiosk.
- **Accent (Hot Pink)**: `#FF1F8F` — HSL(330, 100%, 60%) — alert, promo, badge "BARU".
- **Success (Neon Green)**: `#16A34A` — HSL(142, 70%, 45%) — status PAID, ONLINE, ACTIVE.
- **Danger (Blood Red)**: `#DC2626` — HSL(0, 85%, 55%) — suspend, error, delete.
- **Warning (Amber)**: `#F59E0B` — LOW_PAPER, GRACE_PERIOD, WARNING.
- **Background (Warm White)**: `#FFFEF5` — HSL(48, 100%, 98%).
- **Surface (Cream)**: `#F5F0DC` — HSL(48, 60%, 94%) — card sekunder.
- **Foreground (Ink Black)**: `#141414` — HSL(0, 0%, 8%) — border, text, shadow.
- **Border**: 3–4px solid `#141414` pada card, button, input, modal.
- **Hard Shadow Default**: `box-shadow: 6px 6px 0 0 #141414`.
- **Hard Shadow Pressed**: `box-shadow: 2px 2px 0 0 #141414` + `translate(2px, 2px)`.
- **Kiosk Adaptif**: Owner dapat override primary/accent/background kiosk dengan validasi kontras min 4.5:1.

### Tipografi
- **Heading**: `Space Grotesk` (700/800), uppercase untuk section title, tracking `-0.02em`, clamp 2rem–5rem.
- **Body**: `Inter` (400/500), 16px base, line-height 1.6.
- **Mono/Technical**: `JetBrains Mono` (500) untuk pairing code, token, ID device, log viewer, angka metrik.
- **Kiosk**: Space Grotesk heading + Inter body, minimal 24px untuk semua teks.
- **Angka Metrik**: Space Grotesk 900 + `font-feature-settings: "tnum"`.

### Aturan Komponen (Wajib)
- **Button**: `rounded-md` maksimal, border 3px hitam, shadow 4px 4px 0, hover translate (2px, 2px) + shadow 2px. Variasi: primary (yellow), secondary (violet), destructive (red), outline.
- **Card**: Border 4px hitam, shadow 6px 6px 0, background warm white, header divider 3px.
- **Input/Textarea**: Border 3px hitam, focus ring 2px violet + shadow turun.
- **Badge**: Pill `rounded-full`, border 2px hitam, uppercase kecil, warna status.
- **Dialog/Modal**: Backdrop hitam 60%, modal border 4px, shadow 8px 8px 0, close besar kanan atas.
- **Tabs**: Underline tebal 3px hitam + yellow highlight untuk active.
- **Table**: Header background yellow, border 3px per cell, zebra `#FFFEF5`/`#F5F0DC`.
- **Alert (NeoAlert)**: Border 4px + icon besar, warna severity, auto-dismiss 3s default (success), persistent untuk danger.
- **Slider**: Track 6px hitam, thumb kotak 24×24 hitam border putih.
- **Icons**: `lucide-react` + custom SnapBox set (camera, frame, printer, kiosk, voucher, chroma). Ukuran 20/24/32px.
- **Responsive**: Mobile-first, grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, sidebar drawer mobile, tap target min 44×44px (kiosk min 120×120px).

### Nuansa & Vibe
- **Clean + Bold**: Whitespace generous (gap 32–64px) tapi elemen kunci sangat bold.
- **Micro-animations**: Framer Motion untuk stagger text, marquee, page transition, countdown kiosk.
- **Kiosk Fullscreen**: Adaptif light/dark mengikuti kiosk theme, font besar, tombol besar.
- **Gradient Sengaja**: Hanya hero (yellow → violet → pink) dengan border hitam tebal.
- **Konsol Perangkat**: Terminal-like, mono font, tetap neobrutalism.
- **Anti-Slop Conflict Resolution**: Jika multiple skill (anti-slop, taste, neobrutalism) bertentangan → hierarki: **Most Specific Skill > Project Design System > PRD > General UI Convention**. Semua konflik tertulis sebagai ADR. Dilarang menghasilkan visual Frankenstein (neobrutalism + glassmorphism + material + shadcn default).
- **Dilarang Keras**: Generic SaaS dashboard, semua section card, excessive rounded corners, purple gradient default, glassmorphism tanpa fungsi, repetitive 3-card layout, generic hero, default shadcn appearance, excessive pills, oversized decorative icons, random floating blobs, Inter-only typography jika tidak sesuai brand, whitespace berlebihan yang mengurangi informasi.

### Aksesibilitas Visual
- Kontras teks minimal WCAG 2.2 AA (4.5:1 body, 3:1 large text).
- Focus state selalu terlihat (border + ring + shadow).
- Tidak bergantung warna saja — selalu ada icon + label + text untuk status.

---

## 5. Pembagian Hak Akses Pengguna
*Tabel hak akses + matriks plan tier. Model RBAC granular dengan `permission` string (contoh: `tenant.read`, `booth.pair`, `payment.configure`).*

### 5.1 Matriks Hak Akses Menu / Halaman

| Menu / Halaman | Publik | Customer (Token) | Staff | Owner | CEO |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Landing / Fitur / Harga / Kontak / Kamera | ✅ | ✅ | ✅ | ✅ | ✅ |
| Login Email & Password | ✅ | ❌ | ✅ | ✅ | ✅ |
| Unduh Desktop App | ✅ | ❌ | ✅ | ✅ | ✅ |
| Soft Copy Download `/download/[token]` | ✅ (token) | ✅ (token) | ❌ | ❌ | ❌ |
| CEO Dashboard & Semua Sub-menu | ❌ | ❌ | ❌ | ❌ | ✅ |
| Buat/Suspend/Ban/Hapus/Restore Tenant | ❌ | ❌ | ❌ | ❌ | ✅ |
| Edit Harga & Fitur Paket Global | ❌ | ❌ | ❌ | ❌ | ✅ |
| Kelola Audit Log & Broadcast | ❌ | ❌ | ❌ | ❌ | ✅ |
| Owner Dashboard & Semua Sub-menu | ❌ | ❌ | ❌ | ✅ | ❌ |
| Outlets / Templates / Packages | ❌ | ❌ | ❌ | ✅ | ❌ |
| Machine Manager & Pairing | ❌ | ❌ | ❌ | ✅ | ❌ |
| Device Add-On & Revoke | ❌ | ❌ | ❌ | ✅ | ❌ |
| Frame Studio (Upload & Chroma) | ❌ | ❌ | ❌ | ✅ (kuota plan) | ❌ |
| Kiosk Theme Customizer | ❌ | ❌ | ❌ | ✅ (Growth+) | ❌ |
| Promo & Voucher | ❌ | ❌ | ❌ | ✅ (Growth+) | ❌ |
| Payment Gateway Config | ❌ | ❌ | ❌ | ✅ (Growth+) | ❌ |
| Staff Management CRUD | ❌ | ❌ | ❌ | ✅ | ❌ |
| Customer CRM | ❌ | ❌ | ✅ (masked) | ✅ | ❌ |
| Analytics / Finance / Reports | ❌ | ❌ | ❌ | ✅ | ❌ |
| Export CSV / Bulk ZIP | ❌ | ❌ | ❌ | ✅ | ❌ |
| Subscription B2B & Checkout | ❌ | ❌ | ❌ | ✅ (milik sendiri) | ✅ (semua) |
| Staff Dashboard (Read-Only) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Konsol Perangkat (Web, limit) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Kiosk Payment (Tunai/Voucher/QRIS) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Konsol Perangkat (Tauri via PIN) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Notifikasi In-App Realtime | ❌ | ❌ | ✅ | ✅ | ✅ |

### 5.2 Permission Granular (RBAC)
- **Tenant**: `tenant.read`, `tenant.create`, `tenant.update`, `tenant.suspend`, `tenant.ban`, `tenant.restore`, `tenant.delete`.
- **Booth**: `booth.read`, `booth.create`, `booth.update`, `booth.delete`, `booth.pair`, `booth.revoke`, `booth.maintenance`.
- **Device**: `device.read`, `device.pair`, `device.revoke`, `device.configure`, `device.diagnostics`.
- **Frame**: `frame.read`, `frame.create`, `frame.update`, `frame.delete`, `frame.assign`.
- **Template**: `template.read`, `template.create`, `template.update`, `template.delete`.
- **Package**: `package.read`, `package.create`, `package.update`, `package.delete`.
- **Transaction**: `transaction.read`, `transaction.export`, `transaction.refund`.
- **Customer**: `customer.read`, `customer.read_masked`, `customer.export`.
- **Payment**: `payment.configure`, `payment.test`, `payment.read_credentials`.
- **Staff**: `staff.create`, `staff.update`, `staff.disable`.
- **Subscription**: `subscription.read`, `subscription.manage`.
- **Promo**: `promo.read`, `promo.create`, `promo.update`, `promo.delete`, `promo.batch`.
- **Kiosk**: `kiosk.theme.read`, `kiosk.theme.update`, `kiosk.theme.publish`, `kiosk.lockdown`.
- **Report**: `report.read`, `report.schedule`, `report.export`.
- **Audit**: `audit.read`, `audit.export`.

### 5.3 Batasan Berbasis Plan Tier (Feature Entitlement)

| Fitur | Starter (Rp 100k) | Growth (Rp 180k) | Enterprise (Rp 250k) |
| :--- | :--- | :--- | :--- |
| Device Included | 1 | 1 | 2 |
| Add-On Device | Rp 99k/bln | Rp 99k/bln | Rp 99k/bln |
| Payment Gateway B2C | ❌ (Tunai + Voucher) | ✅ Midtrans (+1 backup) | ✅ Semua provider |
| Jenis Kamera | Webcam saja | Webcam + DSLR | Webcam + DSLR (full) |
| Max Frame Upload | 3 | 15 | Unlimited |
| Storage Soft Copy | 2 GB | 20 GB | 100 GB |
| Retensi Foto | 30 hari | 90 hari | 365 hari |
| Promo & Voucher | ❌ | ✅ Basic | ✅ Advanced + Batch |
| Kustomisasi Kiosk | ❌ default | ✅ Warna + Logo | ✅ Full custom + animasi |
| Gaya Panel Kiosk | Classic | Classic/Card | Classic/Card/Receipt |
| Staff Accounts | 2 | 10 | Unlimited |
| Outlets | 1 | 5 | Unlimited |
| Chroma Key | Auto (green) | Advanced | Advanced + Multi-layer |
| Filter | Basic (3) | Basic + Adjust | Basic + Adjust + Custom LUT |
| Priority Realtime (heartbeat 15s) | ❌ | ✅ | ✅ |
| Support | Email | Email + WA | Priority + Dedicated |

### 5.4 Aturan Staff LAN QR
- QR berisi `lan_token` (JWT 15 menit) + URL `http://<ip-lokal>:3000/staff-auth`.
- Staff login via PIN operator (6 digit, generate Owner).
- Middleware validasi: `role === 'STAFF'` redirect ke `/staff-dashboard`.
- Endpoint LAN hanya dari IP privat (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
- Token one-time, replay protected.

### 5.5 Tenant Isolation Rule (Wajib Server-Side)
- Semua resource tenant-scoped WAJIB memiliki `tenant_id`.
- Server WAJIB memverifikasi: `session.tenant_id === resource.tenant_id`.
- Server DILARANG mempercayai `tenant_id` dari client (form/query/body).
- Postgres RLS policy aktif sebagai lapisan kedua setelah service-layer authorization.
- Cross-tenant access → 404 (bukan 403) untuk mencegah IDOR information disclosure.

---

## 6. Alur Kerja dan Fitur Utama
*Setiap modul memiliki WHY → WHO → HOW → RULES → ERROR → AUDIT.*

### A. Modul Super Admin — Tenant Provisioning & Kontrol Penuh
1. **Cara Kerja**: CEO membuka `/ceo-dashboard/tenants/new`, isi email Owner + nama bisnis, pilih plan + durasi (1/3/12 bulan), klik "Generate Account". Sistem memanggil Firebase Admin SDK (buat user `role: OWNER`, tanpa password) → kirim link set-password via Resend. Sistem buat baris `users`, `tenants`, `b2b_subscriptions` (status PENDING), `booths` default. UI tampilkan Credential Packet (email + link aktivasi + tombol Copy/Resend).
2. **Aturan Sistem**:
   - Self-registration DILARANG — endpoint `/register` tidak boleh ada.
   - Owner WAJIB set password sendiri via link Firebase (expired 24 jam).
   - Email duplikat → 409 Conflict.
   - Setiap Owner WAJIB punya minimal 1 `booths` default.
   - Aksi tercatat di `activity_logs` (actor, action `CREATE_TENANT`, resource_id, metadata).
   - CEO dapat ubah harga & fitur plan → berlaku real-time untuk tenant baru, tenant existing berlaku saat renewal.
   - CEO dapat suspend (login diblok + kiosk Maintenance Mode), ban (login + data tidak diakses), hapus (soft delete + retensi 30 hari).
   - High-risk action (suspend/ban/delete/change pricing) → confirmation dialog + alasan jika relevan + audit log.

### B. Modul Owner — Outlet & Machine Manager, Pairing & Revoke
1. **Cara Kerja**: Owner buka `/owner-dashboard/outlets` → buat cabang. Lalu `/owner-dashboard/machines` → "Add New Device". Sistem buat baris `booths` dengan `pairing_code` (6 karakter alfanumerik uppercase via `crypto.randomBytes`) + `pairing_code_expires_at` 10 menit + QR. Teknisi buka Konsol Perangkat di SnapBox Desktop → scan QR / ketik kode → POST ke `/api/booth/pair`. Status booth ONLINE, Supabase Realtime push konfigurasi ke Desktop.
2. **Aturan Sistem**:
   - Pairing code valid 10 menit (`now() < pairing_code_expires_at`).
   - Pairing session single-use, tenant scoped, booth scoped, HIGH entropy token, server hanya menyimpan hash.
   - Heartbeat Tauri setiap 30 detik (Growth/Enterprise 15 detik); tidak ada heartbeat 90 detik → status OFFLINE.
   - Satu `booth_id` hanya untuk satu perangkat Tauri; pairing kedua ditolak sampai unpair.
   - Revoke device → set `device_fingerprint = null`, `pairing_code = null`, push event `DEVICE_REVOKED` → kiosk wipe session JWT → kembali ke layar "Belum terhubung".
   - Owner hanya lihat/edit booth miliknya (`WHERE tenant_id = session.tenant_id`).
   - Batas jumlah device sesuai plan + add-on (`device_quota`).
   - **ARCHITECTURAL DECISION (ADR-001)**: Pairing code 6 karakter dianggap **legacy/weak** untuk production utama. Mekanisme final = QR + short-lived pairing token (JWT, 10 menit, one-time). Manual code tetap disediakan tapi dengan attempt limit, rate limit, audit, dan hashing server-side.

### C. Modul Owner — Frame Studio & Chroma Key
1. **Cara Kerja**: Owner drag-drop file PNG/JPG ke `/owner-dashboard/frame-studio`. File diunggah ke Supabase Storage `frames/{tenant_id}/{uuid}.png`. Preview canvas dengan checkerboard. Aktifkan "Color Picker Chroma Key" → klik area background frame → simpan `transparent_color_hex` + `tolerance_delta` (default 15). Simpan → pilih booth + toggle "Active on Booth".
2. **Aturan Sistem**:
   - Toleransi warna RGB delta 5–40 (default 15) per channel.
   - Frame wajib PNG/JPG, max 5 MB, dimensi minimum 800×600px.
   - Batas frame per plan: Starter 3, Growth 15, Enterprise unlimited.
   - Maksimum 8 frame aktif per booth.
   - Frame yang sedang aktif tidak boleh dihapus — wajib deactivate dulu.
   - Perubahan `transparent_color_hex` non-retroaktif untuk transaksi yang sudah selesai.
   - Enterprise: multi-layer frame (front + back + overlay sticker).
   - Versioning: setiap update disimpan sebagai versi baru (max 5 versi).
   - Chroma key algorithm: `Input RGB → Target Color → Delta Threshold → Alpha Mask → Edge Refinement → Composite` dengan anti-aliasing + edge cleanup + hair handling.

### D. Modul Owner — Templates & Packages
1. **Cara Kerja**: `/owner-dashboard/templates` → pilih layout (single, strip 2x6, kolase 4-pose, custom). `/owner-dashboard/packages` → CRUD paket (Single Rp 35k, Couple Rp 50k, Family Rp 75k configurable), set retake limit, jumlah pose, print size.
2. **Aturan Sistem**:
   - **Template ≠ Frame ≠ Package ≠ KioskTheme** (jangan disatukan).
   - Template menyimpan: layout, photo slots, aspect ratio, print dimensions, background, frame references, text, QR position, metadata.
   - Frame + Template = output final (composite).
   - Paket bisa di-override per booth (harga berbeda per outlet).
   - Retake limit: Starter 3 max, Growth/Enterprise unlimited.

### E. Modul Owner — Kiosk Theme Customizer
1. **Cara Kerja**: `/owner-dashboard/kiosk-theme` → upload logo (PNG max 500KB), pilih warna primary/accent/background (validation kontras 4.5:1), pilih font (5 preset), edit welcome text, upload video/gambar attract mode (mp4 max 50MB / png max 5MB), CTA text, pilih panel style (Classic/Card/Receipt), orientation (Landscape/Portrait), toggle PIN Lock (PIN 6 digit). Live preview mock kiosk. Publish → push `THEME_UPDATED` via Realtime → kiosk apply ≤ 60 detik.
2. **Aturan Sistem**:
   - Kontras min 4.5:1 (validasi server-side).
   - Attract mode video mp4 H.264 max 50MB atau slideshow dari transaksi `consent_showcase = true`.
   - Theme custom Growth+; panel style multiple Enterprise.
   - Version history max 5 versi.
   - PIN Lock: saat capture session aktif, disable Alt+F4, Windows key, Alt+Tab, Esc (application-level).
   - **Theme Hierarchy (Single Source of Truth)**: `Global defaults → Tenant theme → Booth override → Device runtime configuration`.

### F. Modul Owner — Promo & Voucher Engine
1. **Cara Kerja**: `/owner-dashboard/promos` → "Create Promo" → pilih tipe (Persen/Fixed), kode manual/auto-generate batch (max 500), min purchase, masa berlaku, kuota total, kuota per customer. Toggle aktif → kode langsung bisa dipakai di kiosk. Customer input via virtual keyboard → validasi server → harga adjust.
2. **Aturan Sistem**:
   - Kode voucher case-insensitive, format alfanumerik 4–20 karakter.
   - Validasi server: kuota, masa berlaku, min purchase, per-customer limit, tier aktif.
   - Voucher hanya untuk Growth+.
   - Batch generate max 500 per batch, download CSV.
   - Redemption WAJIB atomic transaction (`SELECT ... FOR UPDATE` + update `quota_used`) → mencegah race condition dua kiosk.
   - Tracking realtime `used_count`.

### G. Modul Owner — Payment Gateway Config (B2C)
1. **Cara Kerja**: `/owner-dashboard/payment-settings` → pilih provider (Midtrans/Xendit/Doku/Pakasir), input API Key + Secret (`type=password`), pilih Sandbox/Production. "Test Connection" → server decrypt (jika ada) → call test endpoint. "Save" → enkripsi AES-256-GCM dengan `ENCRYPTION_MASTER_KEY` → simpan di `b2c_payment_configs.api_key_encrypted` (bytea).
2. **Aturan Sistem**:
   - API Key tidak pernah dikembalikan plaintext ke client (masked `••••••••`).
   - Decryption hanya server-side saat create transaksi.
   - Test call gagal → rollback + error spesifik provider.
   - Satu Owner boleh multiple provider; hanya 1 Primary, sisanya Backup.
   - Batas provider: Starter 0, Growth 2, Enterprise semua.
   - Semua perubahan tercatat di `activity_logs` (tanpa nilai key).
   - **Owner Entry Model (Final)**: Owner memasukkan kredensial gateway sendiri mengikuti docs masing-masing provider. SnapBox menyediakan panduan inline + checklist + tombol "Test Connection" per provider.

### H. Modul Owner — Staff Management & LAN QR Login
1. **Cara Kerja**: `/owner-dashboard/staff` → "Add Staff" → isi nama + email → sistem buat user Firebase `role: STAFF` + `parent_tenant_id` + kirim invite. Staff login via scan QR LAN dari kiosk atau manual `/login`.
2. **Aturan Sistem**:
   - Staff tidak bisa akses route owner (middleware `role === 'STAFF'` → redirect).
   - Staff hanya lihat booths, transactions (email masked), paper_count tenant parent.
   - Owner bisa deactivate staff satu klik (set Firebase `disabled: true`).
   - Batas staff: Starter 2, Growth 10, Enterprise unlimited.
   - LAN QR: `lan_token` JWT 15 menit, hanya valid IP privat, sekali pakai.

### I. Modul Owner — Analytics CRM, Finance, Reports & Customers
1. **Cara Kerja**: Analytics line chart revenue + pie payment method + funnel + retention. Transactions tabel + bulk ZIP. Finance summary + komisi gateway. Customers CRM. Reports export PDF/CSV + jadwal.
2. **Aturan Sistem**:
   - Data analytics di-refresh 5 menit (RSC + `revalidate: 300`).
   - Export CSV max 5.000 baris/request.
   - Bulk ZIP via signed URL Supabase (expired 5 menit).
   - Customer email masked untuk staff (`j***@gmail.com`), full untuk Owner.
   - Report terjadwal via Resend.
   - **Single Event Taxonomy** (lihat Bab 8) — semua metrik traceable ke `transactions` + `activity_logs`.
   - **4 kategori metrik dipisah**: Product Analytics (user action), Operational Metrics (system health), Business Metrics (revenue), Hardware Metrics (booth function).

### J. Modul B2B — Pakasir Subscription Lifecycle & Checkout
1. **Cara Kerja**: Saat Owner dibuat → create invoice Pakasir B2B → email invoice. Owner `/owner-dashboard/subscription` → lihat status → "Perpanjang" / "Upgrade/Downgrade" → generate invoice baru → setelah dibayar, Pakasir POST webhook `/api/webhooks/pakasir-b2b` → validasi HMAC-SHA256 → update `b2b_subscriptions.status = ACTIVE`, `valid_until`. Cron setiap jam cek expired.
2. **Aturan Sistem**:
   - Signature dari header `X-Pakasir-Signature` (HMAC-SHA256).
   - Webhook idempotent: cek `pakasir_transaction_id` UNIQUE → jika ada, return 200 tanpa update.
   - Owner tidak bisa akses dashboard saat expired kecuali `/owner-dashboard/subscription`.
   - Grace period 3 hari sebelum maintenance mode paksa.
   - Notif H-7, H-3, H-1 expiry.
   - Upgrade mid-cycle: prorata + invoice selisih.
   - Downgrade berlaku renewal berikutnya.
   - **Subscription State Machine**: `PENDING → ACTIVE → EXPIRING → GRACE_PERIOD → EXPIRED → SUSPENDED`. (Banned terpisah sebagai state paralel immutable.)

### K. Modul Tauri Desktop — Pairing, Config Sync, & Heartbeat
1. **Cara Kerja**: Tauri buka → welcome screen "Belum terhubung". Konsol Perangkat (tap 5 sudut / hold `Space+V` 5 detik) → PIN admin → tab Panel Operator → masukkan kode pairing. POST `/api/booth/pair` `{ pairing_code, device_fingerprint, app_version, platform }`. Server validasi → balikkan `{ booth_id, session_jwt, booth_config, kiosk_theme }`. App subscribe Supabase Realtime `booth:{booth_id}`.
2. **Aturan Sistem**:
   - Device fingerprint = SHA-256(MAC + OS + app version).
   - JWT session expiry 30 hari, disimpan di OS secure storage (Windows DPAPI / Linux Secret Service). **DILARANG**: localStorage, plaintext JSON, `.env` desktop, SQLite plaintext, cookie tanpa protection.
   - Subscription expired → `SUBSCRIPTION_EXPIRED` → Maintenance Mode ≤ 60 detik.
   - Heartbeat berisi `{ paper_count, camera_id, printer_name, app_version, status, uptime }`.
   - Revocation: push `DEVICE_REVOKED` → kiosk wipe session JWT → kembali ke layar "Belum terhubung".
   - **Device Token**: tidak ditampilkan sebagai credential penuh setelah provisioning, dapat direvoke, dapat dirotasi, expiration/session policy, terikat device + tenant + booth, audit trail.

### L. Modul Tauri Desktop — Attract Mode, Pre-Payment Guide & Voucher Input
1. **Cara Kerja**: Kiosk baca `booths.ui_theme` + `kiosk_themes` → apply warna, font, logo, welcome text, panel style. Attract Mode jika idle > 30 detik: video lokal `resources/attract/*.mp4` atau slideshow (consent) + overlay "SENTUH UNTUK MULAI ✨". Interaksi → Pre-Payment Guide → Package Selection → Voucher Input via virtual keyboard.
2. **Aturan Sistem**:
   - Video attract mode disimpan lokal (tidak butuh internet).
   - Foto lama hanya dari `consent_showcase = true`.
   - Hidden skip tombol sudut kanan bawah.
   - Font: Space Grotesk heading + Inter body kiosk.
   - Virtual keyboard min 120×120px per tombol, alfabetis + numpad, uppercase mode, backspace besar + OK.
   - Validasi voucher server-side, tidak ada validasi client-only.
   - Voucher invalid → NeoAlert merah 3 detik + buzz feedback.
   - **VirtualKeyboard** streaming: number layout untuk numeric input (payment PIN, kode pairing), password masked, close key besar, tidak menutupi CTA, tidak menyebabkan viewport overflow.

### M. Modul Tauri Desktop — Capture, Filter, Adjust & PIN Lock
1. **Cara Kerja**: Setelah PAID → countdown 3-2-1 → **PIN Lock aktif** → capture (webcam via WebRTC / DSLR via SDK Rust bridge). Filter & Adjust layar: grid 6–12 filter preview, slider zoom (1.0–2.5×), slider scale (0.8–1.2×), drag position. Customer "Terapkan" → chroma key process → composite → review → "Cetak" / "Retake". Setelah print sukses → PIN Lock nonaktif.
2. **Aturan Sistem**:
   - PIN Lock: disable Alt+F4, Windows key, Alt+Tab, Esc, Ctrl+Alt+Del (via Windows API hook), gesture trackpad keluar.
   - PIN Lock hanya aktif selama sesi foto (countdown → print sukses).
   - Capture + filter + chroma + composite < 2 detik.
   - OffscreenCanvas + Web Worker (tidak blocking UI).
   - Filter diterapkan sebelum composite.
   - Retake per-sesi; default unlimited, configurable Owner.
   - Output: **raw JPG** (< 500KB, quality 0.85) + **framed JPG** (< 800KB) + **animated GIF 10s burst** (< 3MB).
   - Print sukses → `paper_count` decrement di DB.

### N. Modul Tauri Desktop — Auto Print & Error Handling
1. **Cara Kerja**: Composite siap → panggil Rust `execute_print()` dengan paper size (default 4×6"). Windows spooler otomatis (bypass via default printer + paper preset). Print confirm → decrement `paper_count` via API. Printer error → NeoAlert merah "Printer Offline" + retry/fallback soft copy.
2. **Aturan Sistem**:
   - Print size default 4×6" (configurable, mis. DNP 4x6 potong 2).
   - Printer error → `activity_logs` + notif in-app ke Owner.
   - Paper alert: ≤ 20% → notif Owner email + in-app; ≤ 5% → alert besar + auto disable booth.
   - Fallback print: retry 2× → jika gagal tetap tampilkan QR soft copy.
   - **Print Job ID** untuk mencegah duplicate print (idempotent).
   - **Printer driver popup handling**: DILARANG arbitrary window killing default; gunakan konfigurasi driver dengan supported manner (suppress/minimize via driver setting).

### O. Modul Tauri Desktop — Konsol Perangkat (Diagnostik)
1. **Cara Kerja**: Akses via PIN admin. Tab:
   - **Kamera**: scan device (webcam + DSLR), status USB (data vs charge-only), mode PTP, "Scan Ulang", kalibrasi (mirror, rotasi, zoom) per device fingerprint.
   - **Printer**: pilih printer default via dialog Windows, set paper size + cut mode, test print (`test_print_job_id`), spooler status.
   - **Panel Operator**: generate QR operator, daftar sesi operator aktif, tombol "Lepas Koneksi Booth".
   - **Sistem**: versi app, layanan OS (auto-start), orientasi (landscape/portrait), gaya panel (Classic/Card/Receipt), daftar service conflict (WIA, Canon EOS Utility), tombol "Stop WIA Service" (whitelist), force check subscription, force sync config.
   - **Riwayat & Log**: semua sesi, log aplikasi (INFO/WARN/ERROR), tombol fullscreen konsol (ESC disabled), tombol close, download `.log`.
2. **Aturan Sistem**:
   - Scan kamera otomatis saat konsol dibuka; manual scan available.
   - Kalibrasi tersimpan di `device_calibrations` (per device fingerprint + camera_id).
   - **Camera Troubleshooting Wizard**: 3-step (USB data cable → USB mode PC/PTP → Camera software conflict detection).
   - Service conflict remediation WAJIB: confirmation + audit + privilege + whitelist explicit (tidak otomatis stop arbitrary Windows service).
   - Gaya panel Classic/Card/Receipt: Growth minimal Card, Enterprise semua.
   - Fullscreen konsol: ESC disabled, hanya tombol close UI.
   - Log viewer: filter by level, download `.log`.
   - **Diagnostic action audit**: restart service, stop WIA, change printer, unpair, revoke, change kiosk mode, change orientation, clear cache, delete session — semuanya authenticated + authorized + audited + confirmation jika destruktif.

### P. Modul Customer — Payment & Soft Copy Download
1. **Cara Kerja**: Customer pilih paket → kiosk request `payment_url` + `qr_string` via `/api/payment/create` → tampil QRIS 5 menit / instruksi tunai / voucher. Webhook hit `/api/webhooks/b2c/[provider]` → validasi signature → update `transactions.payment_status = PAID` → Realtime push `START_CAPTURE`. Setelah selesai → QR Code → download via `/download/[token]`.
2. **Aturan Sistem**:
   - Signature webhook: Midtrans SHA512, Xendit callback token constant-time, Doku HMAC, Pakasir HMAC-SHA256.
   - Idempotent (cek `gateway_transaction_id` UNIQUE).
   - QRIS expired 5 menit.
   - Token download: 32 char random, 7 hari, single-use.
   - Customer email opsional (untuk soft copy via email).
   - Starter: tunai/voucher hanya (tidak QRIS).
   - Output: raw JPG + framed JPG + animated GIF.
   - **Server as source of truth**: customer TIDAK BISA masuk capture hanya via client-side state change.

### Q. Modul Notifikasi In-App Realtime
1. **Cara Kerja**: Event penting (`low_paper`, `booth_offline`, `subscription_expiring`, `payment_paid`, `printer_error`, `device_paired`, `device_revoked`) dipush via Supabase Realtime `user:{user_id}`. Bell di header + badge count + dropdown 10 terbaru + link `/notifications`.
2. **Aturan Sistem**:
   - Notif disimpan di `notifications` dengan `is_read`.
   - Realtime push < 2 detik.
   - Broadcast CEO ke semua → channel `broadcast:all`.
   - Notif expire dari UI setelah 30 hari (arsip).
   - Type + severity + title + message + metadata + read state + expiry + tenant scope.

### R. Modul Kiosk Session State Machine (Formal)
Untuk setiap state: purpose, UI, allowed action, timeout, API, database, realtime, error, retry, exit, security rule.
```text
IDLE → ATTRACT → PRE_PAYMENT → PACKAGE_SELECTION → VOUCHER
     → PAYMENT_PENDING → PAYMENT_VERIFIED → COUNTDOWN → CAPTURE
     → RETAKE (loop) → FILTER → ADJUST → REVIEW → PROCESSING
     → PRINTING → SUCCESS → DOWNLOAD → CLEANUP → ATTRACT
```

- **IDLE**: boot selesai, belum ada UI.
- **ATTRACT**: idle > 30 detik, video/slideshow loop, tap = exit ke PRE_PAYMENT.
- **PRE_PAYMENT**: guide 3 langkah, timeout 60 detik idle → ATTRACT.
- **PACKAGE_SELECTION**: kartu paket, timeout 90 detik → ATTRACT.
- **VOUCHER**: virtual keyboard, timeout 60 detik → PACKAGE_SELECTION.
- **PAYMENT_PENDING**: QR/instruksi, timeout 5 menit → EXPIRED → ATTRACT.
- **PAYMENT_VERIFIED**: server-authoritative via webhook, transisi < 2 detik.
- **COUNTDOWN**: 3-2-1, PIN Lock aktif mulai sini.
- **CAPTURE**: live preview + capture/retake, retake limit dari package.
- **FILTER/ADJUST**: filter apply + zoom/scale/drag, PIN Lock aktif.
- **REVIEW**: preview composite, Print / Retake.
- **PROCESSING**: upload multi-format, progress bar.
- **PRINTING**: spooler, print job ID, retry 2×.
- **SUCCESS**: QR soft copy + countdown 60 detik → CLEANUP.
- **DOWNLOAD**: token generate + signed URL.
- **CLEANUP**: PIN Lock off, wipe local files (retention), → ATTRACT.

- **Recovery**: cookie/session state persisted di SQLite local (state engine). Power loss → recover dari last valid state (jika PAID → lanjut ke COUNTDOWN; jika PROCESSING/PRINTING → reconcile; jika ATTRACT → reset).
- **Abandoned session**: > 5 menit tanpa interaksi → cleanup + notif ke staff bila transaksi mid-flow.
- **Stale session cleanup**: cron local delete session > 24 jam.

### S. Modul Photo Processing Pipeline
```text
Capture
↓
Raw Image (JPEG/RAW)
↓
Resize/Optimize
↓
Filter (preset / LUT)
↓
Chroma Key (delta RGB)
↓
Frame Composition (multi-layer Enterprise)
↓
Preview
↓
Final JPEG
↓
GIF (10s burst)
↓
Storage (local + cloud)
↓
Print
↓
QR
```
- Resolution processing: max 3000×4500px, memory cap 512MB per worker.
- Worker: OffscreenCanvas + Web Worker.
- Fallback corrupted image → re-capture button.
- Storage failure → queue upload lokal + retry exponential backoff.

### T. Modul Storage Architecture
- Struktur: `tenant/{tenantId}/frames/`, `tenant/{tenantId}/kiosk/`, `tenant/{tenantId}/transactions/`, `tenant/{tenantId}/reports/`, `tenant/{tenantId}/exports/`.
- Private bucket + signed URL + expiration + MIME validation + file size validation + malware scan (opsional) + image dimension validation.
- Retention dikelola cron sesuai plan.
- **Local storage lifecycle (Kiosk)**: `CAPTURE → LOCAL RAW → PROCESS → LOCAL FINAL → PRINT → UPLOAD → VERIFY UPLOAD → DOWNLOAD TOKEN → RETENTION TIMER → DELETE LOCAL`.
- **Low storage protection**:
  - `> 5 GB`       NORMAL
  - `1–5 GB`       WARNING
  - `500 MB–1 GB`  CRITICAL
  - `< 500 MB`     BLOCK NEW SESSION (diagnostics tetap jalan)

### U. Modul Offline Strategy
- **Allowed offline**: UI lokal, attract mode, cached theme, hardware diagnostics, DSLR capture, local print, local photo processing, cached config.
- **Restricted offline**: new online payment, subscription validation, cloud upload.
- **DILARANG**: client memalsukan status PAID.
- Internet mati → queue upload, queue analytics, exponential backoff retry.
- Jangan kehilangan foto, jangan kehilangan transaksi yang sudah selesai.

### V. Modul Webhook Security (Per Provider)
```
Receive → Validate source → Verify signature → Validate schema
→ Check timestamp → Check idempotency → Acquire lock
→ Update transaction → Emit event → Return 2xx
```
- Duplicate webhook → 200 tanpa update.
- Delayed webhook → diterima selama idempotency OK.
- Out-of-order webhook → state machine handle via `gateway_transaction_id` + event ordering tag.
- Invalid signature → 401, log ke `webhook_failures`.
- Malformed payload → 400 + log.
- Provider outage → retry exponential + dead-letter queue (`webhook_failures`).

---

## 7. Alur Navigasi & Arsitektur Layout
*Peta navigasi + layout persisted + state machine + sequence diagram.*

### 7.1 Arsitektur Layout (Persisten)
- **Public Layout**: Header statis (logo SnapBox + menu Fitur/Harga/Kamera/Tentang/Kontak + Login + CTA "Konsultasi Gratis") + Footer border 4px (sitemap, social, legal).
- **Auth Layout**: Center card neobrutalism, background pattern grid kuning + hitam.
- **CEO Dashboard Layout**: Sidebar fixed kiri (Dashboard, Tenants, Subscriptions, Plans, Devices, Promos, Broadcast, Activity Log, System Health, Security, Settings) + Header (nama CEO, notif bell, logout).
- **Owner Dashboard Layout**: Sidebar fixed kiri lengkap + Header (nama Owner, plan badge Starter/Growth/Enterprise, quota indicator, notif bell).
- **Staff Dashboard Layout**: Sidebar minimal (Dashboard, Machines, Notifications, Profile), tombol destructive disabled (opacity 50%, cursor-not-allowed).
- **Kiosk Layout (Tauri)**: Fullscreen exclusive, tanpa scrollbar, tanpa navbar, state machine menggantikan routing, orientasi adaptif.
- **Device Console Layout**: Tab atas + content full width + footer status teknis + tombol fullscreen (ESC disabled).

### 7.2 Routing Access & Data Source Table

| Route | Access | Layout | Middleware | Data Source | SEO | Cache |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Public | Public | None | Static + ISR | ✅ Full + JSON-LD | revalidate 3600 |
| `/fitur`, `/harga`, `/kamera`, `/tentang`, `/kontak`, `/docs/*` | Public | Public | None | Static + ISR | ✅ Full | revalidate 3600 |
| `/login` | Public | Auth | None | Firebase Client | ✅ | no-store |
| `/ceo-dashboard/*` | CEO | CEO | verifyIdToken + role CEO | Server + Realtime | ❌ noindex | no-store |
| `/owner-dashboard/*` | OWNER | Owner | verifyIdToken + role OWNER + tenant | Server + Realtime | ❌ noindex | no-store |
| `/staff-dashboard/*` | STAFF | Staff | verifyIdToken + role STAFF | Server + Realtime | ❌ noindex | no-store |
| `/download/[token]` | Public (token) | Minimal | Validate token 7d + single-use | DB via Server Action | ❌ noindex | no-store |
| `/api/*` | N/A | N/A | Route handler | Server | ❌ | no-cache |
| `/api/webhooks/*` | Public (signature) | N/A | verify signature | Server | ❌ | no-cache |

### 7.3 Flowchart Utama (High-Level)
```mermaid
flowchart TD
    A[Pengunjung Landing] --> B{Aksi?}
    B -- Konsultasi --> C[Redirect WhatsApp Sales]
    B -- Login --> D[Halaman Login]
    B -- Unduh App --> E[Download Tauri .exe/.deb]
    D --> F{Validasi Firebase Auth}
    F -- Gagal 3x --> G[Rate Limit Cloudflare 5/menit]
    F -- Sukses --> H{Cek Custom Claim Role + Subscription}
    H -- CEO --> I[/ceo-dashboard]
    H -- OWNER akt --> J[/owner-dashboard]
    H -- OWNER exp --> K[/owner-dashboard/subscription]
    H -- STAFF --> L[/staff-dashboard]
    H -- Susp/Ban --> M[/unauthorized]
    I --> I1[Create Tenant + Invite Email]
    I --> I2[Kelola Plans & Harga]
    I --> I3[Suspend/Ban/Delete/Restore Tenant]
    I --> I4[Broadcast + Audit Log]
    I1 --> I5[Pakasir Invoice B2B]
    I5 --> I6[Webhook Pakasir-B2B]
    I6 --> I7[Subscription ACTIVE]
    J --> J0[Outlets & Templates & Packages]
    J --> J1[Machine Manager]
    J1 --> J2[Generate Pairing Code + QR 10min]
    J2 --> J3[Tauri Pair]
    J3 --> J4{Device Quota OK?}
    J4 -- Tidak --> J5[Prompt Add-On Rp99k]
    J4 -- Ya --> J6[Booth ONLINE]
    J --> J7[Revoke Device]
    J --> J8[Frame Studio + Chroma Key]
    J --> J9[Kiosk Theme + PIN Lock]
    J --> J10[Promo & Voucher Engine]
    J --> J11[Payment Gateway Config AES-256]
    J --> J12[Staff CRUD + LAN QR]
    J --> J13[Analytics + Finance + Reports]
    J --> J14[Konsol Perangkat Web]
```

### 7.4 Sequence Diagram — Secure Device Pairing
```mermaid
sequenceDiagram
    participant O as Owner (Web)
    participant S as Server (Next.js)
    participant DB as Supabase DB
    participant K as Tauri Kiosk
    O->>S: POST /api/booth/pair-session {boothId}
    S->>DB: INSERT pairing_tokens {hash, exp=10m, tenant, booth}
    S-->>O: Return {qr_url, manual_code}
    O->>K: Tampilkan QR / ketik manual code
    K->>S: POST /api/booth/pair {code, fingerprint, app_version, platform}
    S->>DB: SELECT pairing_token WHERE hash = H(code) AND NOT used AND exp > now()
    alt Valid
        S->>DB: UPDATE booths SET device_fingerprint, status=ONLINE
        S->>DB: INSERT devices {fingerprint, is_revoked=false}
        S->>DB: UPDATE pairing_token SET used=true
        S->>DB: INSERT activity_logs {action: DEVICE_PAIRED}
        S-->>K: {session_jwt, booth_config, kiosk_theme}
        K->>K: Simpan JWT di OS secure storage
        K->>S: Subscribe Realtime channel booth:{id}
    else Invalid/Expired
        S-->>K: 401 {code: PAIRING_INVALID}
    end
```

### 7.5 Sequence Diagram — Payment & Capture Flow
```mermaid
sequenceDiagram
    participant C as Customer
    participant K as Tauri Kiosk
    participant S as Server (Next.js)
    participant G as Payment Gateway
    participant DB as Supabase DB
    C->>K: Pilih paket + klik Bayar
    K->>S: POST /api/payment/create {boothId, packageId, voucher}
    S->>DB: INSERT transactions {status: PENDING}
    S->>G: Create payment
    G-->>S: {qr_string, payment_url, expires_at}
    S-->>K: {trx_code, qr_string, expires_at}
    K->>C: Tampilkan QR 5 menit
    C->>G: Bayar QRIS
    G->>S: POST /api/webhooks/b2c/{provider}
    S->>S: Verify signature + idempotency
    S->>DB: UPDATE transactions SET status=PAID
    S->>K: Realtime event PAYMENT_PAID
    K->>C: PIN LOCK aktif + Countdown 3-2-1
    K->>K: Capture + Composite
    K->>S: POST /api/transactions/{id}/complete {raw_url, framed_url, gif_url}
    S->>DB: UPDATE paper_count, status COMPLETED
    S-->>K: {download_token}
    K->>C: QR soft copy
```

### 7.6 State Machine Diagram — Kiosk Session
```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> ATTRACT
    ATTRACT --> PRE_PAYMENT: tap
    PRE_PAYMENT --> PACKAGE_SELECTION: "Mulai"
    PACKAGE_SELECTION --> VOUCHER: "Punya Kode"
    PACKAGE_SELECTION --> PAYMENT_PENDING: tanpa voucher
    VOUCHER --> PAYMENT_PENDING: valid
    PAYMENT_PENDING --> PAYMENT_VERIFIED: webhook PAID
    PAYMENT_PENDING --> ATTRACT: timeout 5m
    PAYMENT_VERIFIED --> COUNTDOWN
    COUNTDOWN --> CAPTURE: 3-2-1
    CAPTURE --> RETAKE: retake btn
    RETAKE --> CAPTURE
    CAPTURE --> FILTER: done
    FILTER --> ADJUST
    ADJUST --> REVIEW
    REVIEW --> CAPTURE: retake lagi
    REVIEW --> PROCESSING: cetak
    PROCESSING --> PRINTING
    PRINTING --> SUCCESS: print OK
    PRINTING --> SUCCESS: fallback softcopy
    SUCCESS --> DOWNLOAD
    DOWNLOAD --> CLEANUP
    CLEANUP --> ATTRACT
```

### 7.7 Subscription State Machine
```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> ACTIVE: webhook PAID
    ACTIVE --> EXPIRING: H-7
    EXPIRING --> ACTIVE: renewal
    EXPIRING --> GRACE_PERIOD: H+0
    GRACE_PERIOD --> ACTIVE: bayar
    GRACE_PERIOD --> EXPIRED: H+3
    EXPIRED --> ACTIVE: bayar
    EXPIRED --> SUSPENDED: manual CEO
    SUSPENDED --> ACTIVE: reactivate
```

---

## 8. Kebutuhan Non-Fungsional (SEO, Keamanan, & Performa)
*Production-ready checklist.*

### 8.1 SEO
- `<title>` dinamis via `generateMetadata`, meta description, OG tags di setiap halaman publik.
- `sitemap.xml` dinamis + `robots.txt` (block `/ceo-dashboard`, `/owner-dashboard`, `/staff-dashboard`, `/api/*`).
- JSON-LD: `Product`, `SoftwareApplication`, `Organization`, `FAQPage`.
- Canonical URL + alternate language id-ID.
- OG image dinamis via `@vercel/og`.
- **Jangan mengindeks**: `/dashboard`, `/api`, `/private`, `/download/[token]`.

### 8.2 Keamanan (Zero Trust + Defense in Depth + Least Privilege)
- CSRF: Next.js built-in + `SameSite=Lax` cookies.
- XSS sanitization: DOMPurify + Zod schema validation.
- Validasi server-side WAJIB (Server Actions + Zod).
- AES-256-GCM untuk semua API key payment B2C.
- Firebase Custom Claims (`CEO`, `OWNER`, `STAFF`) — tidak bisa dipalsukan.
- Middleware `middleware.ts` (edge runtime) route protection.
- Cloudflare WAF rate limit:
  - `/api/webhooks/*` → 300 req/min per IP (allowlist gateway IP).
  - `/api/auth/*` → 10 req/min per IP, 5 req/min per email.
  - `/api/booth/*` → 60 req/min per device fingerprint.
  - `/api/payment/create` → 30 req/min per booth.
  - `/api/contact` → 5 req/jam per IP.
  - `/api/operator/*` → 20 req/min per booth.
  - `/api/pairing/*` → 10 req/min per tenant.
- Cloudflare Turnstile pada form kontak & sensitive unauthenticated endpoint.
- JWT Tauri session encrypted via Rust keystore.
- Webhook signature: constant-time compare.
- Idempotency via UNIQUE constraint (`gateway_transaction_id`).
- Audit trail immutable `activity_logs`.
- Soft delete tenant (retensi 30 hari).
- PIN Lock Mode kiosk.
- LAN endpoint staff: rate limited + private IP check.
- Secret management: environment variables + secret manager, no hardcode, no commit, key rotation.
- **DILARANG**:
  - Expose API key ke browser.
  - Expose payment secret.
  - Expose Firebase Admin credential.
  - Hardcode encryption key.
  - Commit secrets ke Git.

### 8.3 Security Acceptance Criteria (Checklist Wajib Lulus)
- [ ] No secrets in frontend
- [ ] API authorization server-side
- [ ] Tenant isolation tested
- [ ] IDOR tested
- [ ] Webhook signature verified
- [ ] Webhook idempotency tested
- [ ] Rate limits active
- [ ] Cloudflare WAF configured
- [ ] Turnstile active
- [ ] Sensitive credentials encrypted
- [ ] Audit log immutable
- [ ] Signed URLs expire
- [ ] Download tokens non-guessable
- [ ] Device revoke works
- [ ] JWT/session revoke works
- [ ] Pairing replay prevented
- [ ] PIN brute force protected
- [ ] Duplicate print prevented
- [ ] File upload MIME + size + dimension validated
- [ ] Path traversal blocked

### 8.4 Cloudflare Architecture
```
User → Cloudflare DNS → Cloudflare CDN → Cloudflare WAF
     → Cloudflare Rate Limiting → Cloudflare Turnstile → Application
```
- **DNS**: domain, proxy, SSL/TLS Full Strict.
- **WAF**: proteksi SQL injection, XSS, malicious bots, suspicious requests, API abuse.
- **Rate Limiting**: per IP + per user + per tenant + per device + burst + cooldown.
- **Turnstile**: contact form, sensitive unauth endpoint.
- **Cache**: cache public assets + landing (revalidate 3600). **JANGAN cache**: dashboard private, payment credentials, private customer data, webhook response, signed private URLs, device credentials.
- **Device API rate limit**: identity = `device_id` + `tenant_id` + IP + credential + endpoint (jangan hanya IP karena NAT).

### 8.5 Performa
- Optimasi gambar via `<Image>` (`avif`, `webp`).
- Lazy loading heavy components via `next/dynamic`.
- Caching: landing revalidate 3600, analytics revalidate 300.
- Realtime channel per tenant (`booth:`, `user:`, `tenant:`).
- Web Worker chroma key + composite (Tauri).
- OffscreenCanvas render.
- CDN Cloudflare + Supabase Storage signed URL.
- Index DB: `tenant_id`, `booth_id`, `payment_status`, `created_at` (BRIN index untuk `activity_logs`, `device_logs`).
- PgBouncer/Supabase Pooler connection pooling.
- Edge runtime untuk public routes, Node runtime untuk API berat.
- **Target**: API P95 < 200ms, Webhook P95 < 500ms, Realtime < 2s, Photo processing < 2s, Landing bundle < 250KB gzip.

### 8.6 Reliabilitas
- Uptime target 99.9%.
- Cron job setiap jam cek subscription expired.
- Webhook retry otomatis (dead letter `webhook_failures`).
- Sentry untuk error tracking (FE + BE).
- Health check `/api/health` (dipantau Cloudflare).
- Backup database otomatis Supabase (daily + PITR 7 hari).

### 8.7 Observability
- Logs, Metrics, Traces, Errors, Audit, Health Checks.
- Monitor: API latency, webhook latency, payment failures, booth offline, camera failures, printer failures, storage failures, realtime disconnect, subscription failures.
- **Log Structured**: timestamp, level (DEBUG/INFO/NOTICE/WARNING/ERROR/CRITICAL), service, device_id, booth_id, tenant_id, session_id, request_id, event, error_code, message, metadata.
- **DILARANG log**: payment secret, API key, device credential, auth token, password, raw webhook signature, sensitive customer data.

### 8.8 Audit Log (Immutable)
- Catat: actor, role, tenant, action, resource, resource_id, timestamp, IP, user_agent, metadata, request_id.
- **JANGAN catat**: password, secret, API key plaintext, payment credential plaintext, sensitive token.

### 8.9 Failure Scenarios & Recovery
- **Camera**: unplugged, sleep, busy, locked by another process, unsupported, USB reconnect, capture timeout, SDK crash → recovery via wizard + re-scan + fallback webcam.
- **Printer**: offline, paper empty/mismatch, busy, driver popup, spooler fail, USB disconnect, duplicate print → recovery via retry + fallback softcopy.
- **Network**: Wi-Fi disconnect, DNS failure, Cloudflare unavailable, Supabase down, Realtime disconnect, payment timeout → graceful degradation + queue.
- **Device**: credential revoked, subscription expired, config corrupt, update failure, disk full, RAM pressure, app crash, Windows restart → safe recovery screen + last known good config.

### 8.10 Data Retention Policy
- Transactions: 7 tahun (legal/audit).
- Photos (soft copy): sesuai plan (Starter 30d, Growth 90d, Enterprise 365d).
- GIF: sama dengan photos.
- Download Tokens: 7 hari aktif, log 30 hari.
- Audit Logs: 5 tahun minimum.
- Webhook Logs: 90 hari.
- Device Logs: 90 hari.
- Notifications: 30 hari (visible) + arsip 12 bulan.
- Deleted Tenants: soft delete + retensi 30 hari.

### 8.11 Privacy & Data Protection
- Customer email, photos, showcase consent, download token, tenant data, staff data, payment metadata — semua sensitive.
- Customer dapat grant/deny `consent_showcase` → jika tidak consent: foto TIDAK BOLEH muncul di attract mode, TIDAK BOLEH digunakan marketing.
- Privacy policy + ToS + DPA templates tersedia.

### 8.12 Accessibility (WCAG 2.2 AA)
- Keyboard navigation, focus state, color contrast, screen reader, ARIA, touch target ≥ 44×44px, reduced motion support, error messaging, form labels, accessible states (jangan bergantung warna saja).

### 8.13 Responsive Design
- Breakpoints: Mobile `< 640px`, Tablet `640–1024px`, Desktop `1024–1440px`, Large `> 1440px`, Kiosk `1080p landscape/portrait`.
- Dashboard desktop-first, responsive, tablet usable, sidebar → drawer, tabel → responsive list jika perlu.
- Kiosk fullscreen, touch-first, no accidental navigation, hit target besar, readable dari jarak jauh.

---

## 9. Panduan Bahasa, Copywriting, & Data Dummy
*Tone of Voice + contoh data.*

### Gaya Bahasa
- **Profesional, ramah, membumi**. Gunakan "Anda" untuk pemilik bisnis, "Kamu" untuk customer kiosk.
- Landing page: hindari jargon teknis, gunakan "cara kerja" sederhana.
- Dashboard: boleh teknis dan dense.
- Kiosk: bahasa santai + emoji (✨, 🎉, 📸).

### Instruksi Data Dummy
- **JANGAN PERNAH MENGGUNAKAN "Lorem Ipsum"**.
- Selalu gunakan data dummy Bahasa Indonesia yang relevan.

### Contoh Data Dummy

**Tenant (contoh 6 dari 127)**:
- "Pixelbooth Indonesia" — Jakarta Pusat — Growth — `budi@pixelbooth.id` — ACTIVE.
- "Snap Moment Studio" — Bandung — Enterprise — `sari@snapmoment.id` — ACTIVE.
- "Klik Klik Photobooth" — Surabaya — Starter — `dedi@klikklik.id` — ACTIVE.
- "Pose Ku Photobooth" — Yogyakarta — Growth — `rina@poseku.id` — SUSPENDED.
- "Ceria Foto Booth" — Makassar — Starter — `anto@ceriafoto.id` — EXPIRED.
- "Momen Kita Photo" — Semarang — Growth — `lina@momenkita.id` — GRACE_PERIOD.

**Booth / Machine**:
- Booth 1 "Paris Van Java Lantai 2" — ONLINE — Paper 180/200 — Outlet "Bandung" — Canon EOS 200D.
- Booth 2 "Grand Indonesia Lantai 5" — OFFLINE — Paper 12/200 (LOW PAPER) — Outlet "Jakarta" — Sony A6000.
- Booth 3 "Tunjungan Plaza Lantai 4" — ONLINE — Paper 90/200 — Outlet "Surabaya" — Webcam Logitech C920.
- Booth 4 "Malioboro Mall FF" — MAINTENANCE — Paper 0/200 — Outlet "Yogyakarta" — Nikon D5600.

**Frame**:
- "Wedding Classic Gold" — 1200×1800 PNG — Chroma `#00FF00` — Aktif 3 booth.
- "Birthday Confetti Pop" — 1200×1800 PNG — Chroma `#FF00FF` — Aktif 5 booth.
- "Neon Cyberpunk" — 1200×1800 PNG — Chroma `#00FFFF` — Aktif 2 booth.
- "Keluarga Ceria Idul Fitri" — 1200×1800 PNG — Chroma `#00FF00` — Aktif 8 booth.
- "Graduation Blue Frame" — 1200×1800 PNG — Chroma `#0000FF` — Draft.

**Paket Foto**:
- "Paket Single" — Rp 35.000 — 1 pose, 1 cetak, unlimited retake.
- "Paket Couple" — Rp 50.000 — 3 pose, 2 cetak, unlimited retake.
- "Paket Keluarga" — Rp 75.000 — 5 pose, 4 cetak, unlimited retake + extra GIF.

**Voucher**:
- "DISKON20" — Fixed Rp 20.000 — Min Rp 35.000 — 1–31 Des 2025 — Kuota 100 — Aktif.
- "GRATISGIF" — Persen 15% — Min Rp 50.000 — Kuota 500 — Aktif.
- "NEWYEAR2026" — Fixed Rp 10.000 — Min Rp 35.000 — Kuota 200 — Belum Aktif.
- "SNAPBOXNEW" — Fixed Rp 20.000 (B2B langganan) — Global — Kuota unlimited.

**Transaksi**:
- TRX-251112-001234 — "Paris Van Java" — Paket Couple Rp 50.000 — Voucher DISKON20 — Total Rp 30.000 — QRIS Midtrans — PAID — `fitri@gmail.com` — Printed ✅.
- TRX-251112-001235 — "Grand Indonesia" — Paket Single Rp 35.000 — Tunai — PAID — Printed ✅ — Consent showcase ✅.
- TRX-251112-001236 — "Tunjungan Plaza" — Paket Keluarga Rp 75.000 — Voucher GRATISGIF 15% — Total Rp 63.750 — QRIS — PAID — Printed ❌ (Printer Offline) — Fallback soft copy.

**Staff**:
- "Andi Pratama" — `andi@pixelbooth.id` — Staff Lapangan — Booth 1 & 2 — ACTIVE.
- "Maya Sari" — `maya@snapmoment.id` — Staff Teknisi — Booth 5, 6, 7 — ACTIVE.
- "Reza Fahlevi" — `reza@klikklik.id` — Staff Operator — DEACTIVATED.

**Notifikasi In-App**:
- ⚠️ "Stok kertas Booth 'Grand Indonesia' tersisa 12 lembar (6%). Segera isi ulang."
- 🔴 "Booth 'Malioboro FF' OFFLINE sejak 15 menit lalu (last heartbeat 14:32)."
- 💳 "Pembayaran berhasil: TRX-251112-001234 Rp 30.000 via QRIS Midtrans."
- ⏰ "Langganan Anda berakhir dalam 7 hari. Perpanjang sekarang untuk hindari downtime."

**Copy Kiosk**:
- Attract: "📸 SENTUH UNTUK MULAI ✨ Foto Keren Dalam 60 Detik!"
- Pre-Payment: "Gampang Banget! 1️⃣ Pilih Paket → 2️⃣ Bayar → 3️⃣ Pose!"
- Countdown: "3... 2... 1... SENYUM! 😁"
- Processing: "Bersiap-siap... jangan kemana-mana ya! ✨"
- Success: "🎉 Fotomu jadi! Scan QR untuk download (raw + frame + GIF)"

---

## 10. Fondasi Teknis (Untuk Tim Pengembang / Programmer & AI)

### 10.1 Bahasa & Framework
- **Web (Landing + Dashboard + Kiosk UI)**: Next.js 15 (App Router) + React 19 + TypeScript 5.x (strict mode).
- **Server**: Next.js Route Handlers + Server Actions (Node runtime untuk berat, Edge untuk public).
- **Desktop Kiosk**: Tauri v2 (Rust 1.77+) + React + TypeScript.
- **Hardware Bridge**: Rust crate kustom `snapbox-camera` (Canon EDSDK wrapper, Nikon PTP, Sony Camera Remote SDK) + `snapbox-printer` (Windows Spooler + CUPS).
- **Device Console Web**: React + WebUSB/WebSerial fallback (read-only subset).

### 10.2 UI Stack
- Tailwind CSS v4 + `@tailwindcss/typography`.
- **neobrutalism-components** (ekmas) sebagai base UI library.
- **shadcn/ui** untuk primitive belum ada (DropdownMenu, Dialog anatomy).
- **Lucide Icons** + custom SnapBox icon set.
- **Framer Motion** untuk micro-animation.
- **Recharts** untuk analytics.
- **react-dropzone** untuk frame upload.
- **react-colorful** untuk color picker.
- **react-hook-form** + **Zod** untuk form & validation.

### 10.3 Authentication
- **Firebase Authentication** (Email & Password) + **Firebase Admin SDK** untuk create user + custom claims (`role`, `tenant_id`, `parent_tenant_id`).
- Firebase email action handler untuk set-password & reset.
- Middleware Next.js verifyIdToken + custom claims check.
- **Staff LAN QR**: JWT lokal 15 menit → hanya valid IP privat.
- Session revocation, disabled user, MFA opsional untuk CEO.

### 10.4 Database & Storage
- **Supabase PostgreSQL** (managed, PG 15) + **Drizzle ORM** (schema-first).
- **Supabase Realtime** (channel per booth/user/tenant).
- **Supabase Storage** bucket: `frames`, `branding`, `attract`, `soft-copies`, `reports`, `logs`.
- **Cloudflare Workers KV** untuk rate limit counter.
- **Supabase pg_cron** untuk scheduled jobs.
- **PgBouncer / Supabase Pooler** untuk connection pooling.
- **RLS aktif** untuk tenant isolation (lapisan kedua).

### 10.5 Realtime Channels
- `booth:{boothId}`: config, print, subscription, capture.
- `tenant:{tenantId}`: meta update (staff presence, promo update).
- `user:{userId}`: personal notifications.
- `broadcast:all`: CEO broadcast.

### 10.6 Event Catalog (Realtime)
- `DEVICE_PAIRED`, `DEVICE_REVOKED`, `DEVICE_ONLINE`, `DEVICE_OFFLINE`.
- `BOOTH_ONLINE`, `BOOTH_OFFLINE`, `CONFIG_UPDATED`, `THEME_UPDATED`.
- `PACKAGE_UPDATED`, `FRAME_UPDATED`, `PROMO_UPDATED`.
- `PAYMENT_PENDING`, `PAYMENT_PAID`, `PAYMENT_FAILED`.
- `START_CAPTURE`, `PRINT_STARTED`, `PRINT_SUCCESS`, `PRINT_FAILED`.
- `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`.
- `LOW_PAPER`, `MAINTENANCE_MODE_ON`, `MAINTENANCE_MODE_OFF`.

Setiap event punya: `event_id`, `version`, `timestamp`, `tenant_id`, `booth_id`, `device_id`, `payload`. Handler wajib **idempotent**.

### 10.7 Stack Deployment
- **Web**: Vercel (production + preview), Edge + Node runtimes.
- **Cloudflare**: DNS + WAF + Turnstile + Workers KV.
- **Desktop**: GitHub Actions build Tauri (Windows NSIS, Linux .deb) → rilis Github Releases + mirror `/unduh-aplikasi`.
- **Database**: Supabase production tier.
- **Monitoring**: Sentry + Vercel Analytics.
- **Email**: Resend (invite, invoice, low paper alert, report).
- **Payment B2C**: Midtrans (default), Xendit, Doku, Pakasir — via `PaymentProvider` interface.
- **Payment B2B**: Pakasir (subscription SaaS).

### 10.8 PaymentProvider Interface
```typescript
interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(trxId: string): Promise<PaymentStatus>;
  handleWebhook(req: Request): Promise<WebhookResult>;
  refund(trxId: string, amount?: number): Promise<RefundResult>;
  getStatus(trxId: string): Promise<PaymentStatus>;
  testConnection(): Promise<TestResult>;
}
```

### 10.9 Hardware Adapter Interfaces
```typescript
interface CameraAdapter {
  scan(): Promise<CameraDevice[]>;
  connect(id: string): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<CameraStatus>;
  capture(): Promise<CapturedPhoto>;
  setMode(mode: CameraMode): Promise<void>;
  setZoom(value: number): Promise<void>;
}

interface PrinterAdapter {
  scan(): Promise<PrinterDevice[]>;
  connect(id: string): Promise<void>;
  getStatus(): Promise<PrinterStatus>;
  testPrint(config: PrintConfig): Promise<PrintResult>;
  print(job: PrintJob): Promise<PrintResult>;
}

interface StorageAdapter {
  uploadFile(path: string, data: Buffer, mime: string): Promise<UploadResult>;
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
  deleteFile(path: string): Promise<void>;
}

interface DeviceAdapter {
  getFingerprint(): Promise<string>;
  storeCredential(token: string): Promise<void>;
  readCredential(): Promise<string | null>;
  wipeCredential(): Promise<void>;
}
```

Implementasi konkret: `CanonAdapter`, `NikonAdapter`, `SonyAdapter`, `WebcamAdapter`, `WindowsSpoolerPrinter`, `DNPPrinter`, `EpsonPrinter`, `CanonPrinter`.

### 10.10 Tauri Command Security
- Setiap command: validate input, authorize operation, check device state, check session state, sanitize path, limit file size, return typed error, log safe metadata.
- **DILARANG command**: `execute_shell(command)`, `run_powershell(command)`, `run_arbitrary_process(command)`.

### 10.11 Filesystem Security
- Path tidak berasal langsung dari input user.
- Gunakan UUID + allowlisted directory + canonicalized path + extension validation + MIME validation + size limit.
- Contoh aman: `C:\SnapBox\data\sessions\<uuid>\`.
- Contoh BAHAYA: `C:\SnapBox\data\<user_input>\`.

### 10.12 Struktur Skema Database (Drizzle ORM + Supabase PostgreSQL)
```typescript
// src/db/schema.ts
import {
  pgTable, uuid, text, varchar, timestamp, integer, boolean, jsonb,
  pgEnum, bytea, numeric, index, uniqueIndex, primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============ ENUMS ============
export const userRoleEnum = pgEnum("user_role", ["CEO", "OWNER", "STAFF"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"]);
export const planTierEnum = pgEnum("plan_tier", ["STARTER", "GROWTH", "ENTERPRISE"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "PENDING", "ACTIVE", "EXPIRING", "GRACE_PERIOD", "EXPIRED", "SUSPENDED", "CANCELLED",
]);
export const boothStatusEnum = pgEnum("booth_status", ["ONLINE", "OFFLINE", "MAINTENANCE", "UNPAIRED", "DEGRADED"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "QRIS_MIDTRANS", "QRIS_XENDIT", "QRIS_DOKU", "QRIS_PAKASIR", "VOUCHER"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED"]);
export const promoTypeEnum = pgEnum("promo_type", ["PERCENTAGE", "FIXED_AMOUNT"]);
export const gatewayProviderEnum = pgEnum("gateway_provider", ["MIDTRANS", "XENDIT", "DOKU", "PAKASIR"]);
export const gatewayModeEnum = pgEnum("gateway_mode", ["SANDBOX", "PRODUCTION"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "LOW_PAPER", "BOOTH_OFFLINE", "SUBSCRIPTION_EXPIRING", "PAYMENT_PAID",
  "PRINTER_ERROR", "DEVICE_PAIRED", "DEVICE_REVOKED", "BROADCAST", "GENERAL", "CAMERA_ERROR",
]);
export const kioskPanelStyleEnum = pgEnum("kiosk_panel_style", ["CLASSIC", "CARD", "RECEIPT"]);
export const orientationEnum = pgEnum("orientation", ["LANDSCAPE", "PORTRAIT"]);
export const cameraStatusEnum = pgEnum("camera_status", ["SUPPORTED", "LIMITED", "EXPERIMENTAL", "NOT_SUPPORTED", "DEPRECATED"]);

// ============ USERS ============
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firebaseUid: varchar("firebase_uid", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  role: userRoleEnum("role").notNull(),
  tenantId: uuid("tenant_id"),
  parentTenantId: uuid("parent_tenant_id"),
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  roleIdx: index("users_role_idx").on(t.role),
  tenantIdx: index("users_tenant_idx").on(t.tenantId),
}));

// ============ TENANTS ============
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: varchar("company_name", { length: 200 }).notNull(),
  ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
  ownerPhone: varchar("owner_phone", { length: 20 }),
  address: text("address"),
  logoUrl: text("logo_url"),
  planTier: planTierEnum("plan_tier").notNull().default("STARTER"),
  status: tenantStatusEnum("status").notNull().default("ACTIVE"),
  deviceQuota: integer("device_quota").notNull().default(1),
  addOnDevices: integer("add_on_devices").notNull().default(0),
  frameQuota: integer("frame_quota").notNull().default(3),
  storageQuotaMb: integer("storage_quota_mb").notNull().default(2048),
  staffQuota: integer("staff_quota").notNull().default(2),
  retentionDays: integer("retention_days").notNull().default(30),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  statusIdx: index("tenants_status_idx").on(t.status),
  planIdx: index("tenants_plan_idx").on(t.planTier),
}));

// ============ PLANS ============
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: planTierEnum("tier").notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  priceMonthly: numeric("price_monthly", { precision: 12, scale: 2 }).notNull(),
  priceYearly: numeric("price_yearly", { precision: 12, scale: 2 }),
  features: jsonb("features").notNull().$type<{
    deviceIncluded: number; addOnPricePerDevice: number;
    paymentGatewayB2C: boolean; backupGateway: boolean;
    cameraTypes: string[]; maxFrameUpload: number;
    storageMb: number; retentionDays: number;
    promoEnabled: boolean; promoAdvanced: boolean;
    kioskCustomEnabled: boolean; kioskMultiplePanelStyle: boolean;
    staffLimit: number; outletLimit: number;
    chromaKeyLevel: "AUTO" | "ADVANCED" | "MULTILAYER";
    filterLevel: "BASIC" | "ADJUST" | "CUSTOM_LUT";
    supportLevel: string; priorityRealtime: boolean;
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ B2B SUBSCRIPTIONS ============
export const b2bSubscriptions = pgTable("b2b_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  planTier: planTierEnum("plan_tier").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("PENDING"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  gracePeriodUntil: timestamp("grace_period_until", { withTimezone: true }),
  pakasirInvoiceId: varchar("pakasir_invoice_id", { length: 128 }).unique(),
  pakasirPaymentUrl: text("pakasir_payment_url"),
  pakasirTransactionId: varchar("pakasir_transaction_id", { length: 128 }).unique(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("b2b_subs_tenant_idx").on(t.tenantId),
  statusIdx: index("b2b_subs_status_idx").on(t.status),
  expiryIdx: index("b2b_subs_expiry_idx").on(t.validUntil),
}));

// ============ OUTLETS ============
export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  picName: varchar("pic_name", { length: 150 }),
  picPhone: varchar("pic_phone", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("outlets_tenant_idx").on(t.tenantId),
}));

// ============ BOOTHS ============
export const booths = pgTable("booths", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  outletId: uuid("outlet_id").references(() => outlets.id, { onDelete: "set null" }),
  name: varchar("name", { length: 150 }).notNull(),
  locationTag: varchar("location_tag", { length: 150 }),
  status: boothStatusEnum("status").notNull().default("UNPAIRED"),
  pairingCode: varchar("pairing_code", { length: 12 }),
  pairingCodeHash: varchar("pairing_code_hash", { length: 128 }),
  pairingCodeExpiresAt: timestamp("pairing_code_expires_at", { withTimezone: true }),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }).unique(),
  paperCount: integer("paper_count").notNull().default(0),
  paperCapacity: integer("paper_capacity").notNull().default(200),
  paperAlertThresholdPct: integer("paper_alert_threshold_pct").notNull().default(20),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  pinLockEnabled: boolean("pin_lock_enabled").notNull().default(false),
  pinLockPinHash: varchar("pin_lock_pin_hash", { length: 128 }),
  operatorPinHash: varchar("operator_pin_hash", { length: 128 }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  cameraId: varchar("camera_id", { length: 120 }),
  cameraType: varchar("camera_type", { length: 40 }),
  printerName: varchar("printer_name", { length: 200 }),
  printerPaperSize: varchar("printer_paper_size", { length: 40 }).default("4x6"),
  printerPort: varchar("printer_port", { length: 60 }),
  printerVendor: varchar("printer_vendor", { length: 60 }),
  printerModel: varchar("printer_model", { length: 120 }),
  displayOrientation: orientationEnum("display_orientation").notNull().default("LANDSCAPE"),
  appVersion: varchar("app_version", { length: 40 }),
  platform: varchar("platform", { length: 40 }),
  configVersion: integer("config_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("booths_tenant_idx").on(t.tenantId),
  statusIdx: index("booths_status_idx").on(t.status),
  outletIdx: index("booths_outlet_idx").on(t.outletId),
  fpIdx: uniqueIndex("booths_fp_idx").on(t.deviceFingerprint),
}));

// ============ DEVICES ============
export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }).notNull().unique(),
  appVersion: varchar("app_version", { length: 40 }),
  platform: varchar("platform", { length: 40 }),
  osVersion: varchar("os_version", { length: 120 }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  uptimeSeconds: integer("uptime_seconds"),
  sessionJwtHash: varchar("session_jwt_hash", { length: 128 }),
  isRevoked: boolean("is_revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  boothIdx: index("devices_booth_idx").on(t.boothId),
  tenantIdx: index("devices_tenant_idx").on(t.tenantId),
}));

// ============ PAIRING TOKENS ============
export const pairingTokens = pgTable("pairing_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 128 }).notNull(),
  manualCode: varchar("manual_code", { length: 12 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdByUserId: uuid("created_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("pair_code_idx").on(t.codeHash),
  boothIdx: index("pair_booth_idx").on(t.boothId),
}));

// ============ DEVICE CALIBRATIONS ============
export const deviceCalibrations = pgTable("device_calibrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceFingerprint: varchar("device_fingerprint", { length: 128 }).notNull(),
  cameraId: varchar("camera_id", { length: 120 }).notNull(),
  mirrorX: boolean("mirror_x").notNull().default(false),
  mirrorY: boolean("mirror_y").notNull().default(false),
  rotationDeg: integer("rotation_deg").notNull().default(0),
  zoomLevel: numeric("zoom_level", { precision: 4, scale: 2 }).notNull().default("1.00"),
  offsetX: integer("offset_x").notNull().default(0),
  offsetY: integer("offset_y").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  fpCamIdx: uniqueIndex("calib_fp_cam_idx").on(t.deviceFingerprint, t.cameraId),
}));

// ============ FRAMES ============
export const frames = pgTable("frames", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  storageUrl: text("storage_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  layer: varchar("layer", { length: 20 }).notNull().default("FRONT"),
  transparentColorHex: varchar("transparent_color_hex", { length: 9 }),
  toleranceDelta: integer("tolerance_delta").notNull().default(15),
  width: integer("width"),
  height: integer("height"),
  fileSizeBytes: integer("file_size_bytes"),
  isActive: boolean("is_active").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index("frames_tenant_idx").on(t.tenantId),
  activeIdx: index("frames_active_idx").on(t.isActive),
}));

// ============ FRAME VERSIONS ============
export const frameVersions = pgTable("frame_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  frameId: uuid("frame_id").notNull().references(() => frames.id, { onDelete: "cascade" }),
  storageUrl: text("storage_url").notNull(),
  transparentColorHex: varchar("transparent_color_hex", { length: 9 }),
  toleranceDelta: integer("tolerance_delta").notNull().default(15),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ BOOTH FRAME ASSIGNMENTS ============
export const boothFrames = pgTable("booth_frames", {
  boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
  frameId: uuid("frame_id").notNull().references(() => frames.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.boothId, t.frameId] }),
}));

// ============ TEMPLATES ============
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  layoutType: varchar("layout_type", { length: 40 }).notNull(),
  poseGrid: jsonb("pose_grid").$type<{ rows: number; cols: number; padding: number }>(),
  printDimensions: varchar("print_dimensions", { length: 40 }),
  aspectRatio: varchar("aspect_ratio", { length: 20 }),
  background: varchar("background", { length: 20 }),
  previewUrl: text("preview_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ PACKAGES ============
export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id").references(() => booths.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  poseCount: integer("pose_count").notNull().default(1),
  printCount: integer("print_count").notNull().default(1),
  retakeLimit: integer("retake_limit").notNull().default(-1),
  includeGif: boolean("include_gif").notNull().default(true),
  printSize: varchar("print_size", { length: 20 }).notNull().default("4x6"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ KIOSK THEMES ============
export const kioskThemes = pgTable("kiosk_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id").references(() => booths.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 9 }).notNull().default("#FFDD00"),
  accentColor: varchar("accent_color", { length: 9 }).notNull().default("#8B5CF6"),
  backgroundColor: varchar("background_color", { length: 9 }).notNull().default("#FFFEF5"),
  fontFamily: varchar("font_family", { length: 80 }).notNull().default("Space Grotesk"),
  welcomeText: text("welcome_text"),
  ctaText: varchar("cta_text", { length: 120 }).default("SENTUH UNTUK MULAI ✨"),
  attractModeType: varchar("attract_mode_type", { length: 20 }).notNull().default("VIDEO"),
  attractVideoUrl: text("attract_video_url"),
  attractSlideshowEnabled: boolean("attract_slideshow_enabled").notNull().default(true),
  panelStyle: kioskPanelStyleEnum("panel_style").notNull().default("CLASSIC"),
  orientation: orientationEnum("orientation").notNull().default("LANDSCAPE"),
  prePaymentGuide: jsonb("pre_payment_guide").$type<{ steps: { title: string; desc: string; icon: string }[] }>(),
  version: integer("version").notNull().default(1),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ KIOSK THEME VERSIONS ============
export const kioskThemeVersions = pgTable("kiosk_theme_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  themeId: uuid("theme_id").notNull().references(() => kioskThemes.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ PROMOS ============
export const promos = pgTable("promos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  isGlobal: boolean("is_global").notNull().default(false),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 150 }),
  type: promoTypeEnum("type").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  minPurchase: numeric("min_purchase", { precision: 12, scale: 2 }).notNull().default("0"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  quotaTotal: integer("quota_total"),
  quotaUsed: integer("quota_used").notNull().default(0),
  quotaPerCustomer: integer("quota_per_customer").notNull().default(1),
  boothScope: jsonb("booth_scope").$type<string[]>(),
  packageScope: jsonb("package_scope").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  codeIdx: uniqueIndex("promos_code_idx").on(t.code),
  tenantIdx: index("promos_tenant_idx").on(t.tenantId),
}));

// ============ PROMO REDEMPTIONS ============
export const promoRedemptions = pgTable("promo_redemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  promoId: uuid("promo_id").notNull().references(() => promos.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  transactionId: uuid("transaction_id"),
  customerEmail: varchar("customer_email", { length: 255 }),
  discountApplied: numeric("discount_applied", { precision: 12, scale: 2 }).notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  promoIdx: index("redemption_promo_idx").on(t.promoId),
  customerIdx: index("redemption_customer_idx").on(t.customerEmail),
}));

// ============ B2C PAYMENT CONFIGS ============
export const b2cPaymentConfigs = pgTable("b2c_payment_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  provider: gatewayProviderEnum("provider").notNull(),
  mode: gatewayModeEnum("mode").notNull().default("SANDBOX"),
  apiKeyEncrypted: bytea("api_key_encrypted"),
  secretKeyEncrypted: bytea("secret_key_encrypted"),
  merchantId: varchar("merchant_id", { length: 120 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
  lastTestSuccess: boolean("last_test_success"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantProviderIdx: uniqueIndex("b2c_provider_tenant_idx").on(t.tenantId, t.provider),
}));

// ============ TRANSACTIONS ============
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  trxCode: varchar("trx_code", { length: 40 }).notNull().unique(),
  boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").references(() => devices.id),
  packageId: uuid("package_id").references(() => packages.id),
  packageName: varchar("package_name", { length: 100 }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  finalAmount: numeric("final_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  gatewayProvider: gatewayProviderEnum("gateway_provider"),
  gatewayTransactionId: varchar("gateway_transaction_id", { length: 200 }).unique(),
  gatewayPaymentUrl: text("gateway_payment_url"),
  gatewayQrString: text("gateway_qr_string"),
  gatewayExpiresAt: timestamp("gateway_expires_at", { withTimezone: true }),
  voucherCode: varchar("voucher_code", { length: 20 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  customerConsentShowcase: boolean("customer_consent_showcase").notNull().default(false),
  filterApplied: varchar("filter_applied", { length: 60 }),
  poseCount: integer("pose_count").notNull().default(1),
  retakeUsed: integer("retake_used").notNull().default(0),
  rawPhotoUrl: text("raw_photo_url"),
  framedPhotoUrl: text("framed_photo_url"),
  gifUrl: text("gif_url"),
  softCopyToken: varchar("soft_copy_token", { length: 64 }).unique(),
  softCopyTokenExpiresAt: timestamp("soft_copy_token_expires_at", { withTimezone: true }),
  softCopyTokenUsed: boolean("soft_copy_token_used").notNull().default(false),
  printed: boolean("printed").notNull().default(false),
  printerError: text("printer_error"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  printedAt: timestamp("printed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  boothIdx: index("trx_booth_idx").on(t.boothId),
  tenantIdx: index("trx_tenant_idx").on(t.tenantId),
  statusIdx: index("trx_status_idx").on(t.paymentStatus),
  createdIdx: index("trx_created_idx").on(t.createdAt),
  tokenIdx: uniqueIndex("trx_token_idx").on(t.softCopyToken),
  gatewayIdx: uniqueIndex("trx_gateway_idx").on(t.gatewayTransactionId),
}));

// ============ ACTIVITY LOGS ============
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  actorEmail: varchar("actor_email", { length: 255 }),
  actorRole: userRoleEnum("actor_role"),
  tenantId: uuid("tenant_id"),
  boothId: uuid("booth_id"),
  deviceId: uuid("device_id"),
  action: varchar("action", { length: 80 }).notNull(),
  resourceType: varchar("resource_type", { length: 60 }),
  resourceId: varchar("resource_id", { length: 80 }),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 60 }),
  userAgent: text("user_agent"),
  requestId: varchar("request_id", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorIdx: index("log_actor_idx").on(t.actorUserId),
  tenantIdx: index("log_tenant_idx").on(t.tenantId),
  actionIdx: index("log_action_idx").on(t.action),
  createdIdx: index("log_created_idx").on(t.createdAt),
}));

// ============ NOTIFICATIONS ============
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id"),
  type: notificationTypeEnum("type").notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("INFO"),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("notif_user_idx").on(t.userId),
  tenantIdx: index("notif_tenant_idx").on(t.tenantId),
  readIdx: index("notif_read_idx").on(t.isRead),
}));

// ============ BROADCASTS ============
export const broadcasts = pgTable("broadcasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  targetTenantIds: jsonb("target_tenant_ids").$type<string[]>(),
  targetAll: boolean("target_all").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ PAPER LOGS ============
export const paperLogs = pgTable("paper_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  boothId: uuid("booth_id").notNull().references(() => booths.id, { onDelete: "cascade" }),
  oldCount: integer("old_count").notNull(),
  newCount: integer("new_count").notNull(),
  delta: integer("delta").notNull(),
  reason: varchar("reason", { length: 60 }).notNull(),
  updatedByUserId: uuid("updated_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  boothIdx: index("paper_booth_idx").on(t.boothId),
}));

// ============ WEBHOOK EVENTS (idempotency) ============
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 40 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 200 }).notNull(),
  eventType: varchar("event_type", { length: 80 }),
  payload: jsonb("payload").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqIdx: uniqueIndex("wh_event_uniq_idx").on(t.provider, t.providerEventId),
}));

// ============ WEBHOOK FAILURES (dead-letter) ============
export const webhookFailures = pgTable("webhook_failures", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: varchar("provider", { length: 40 }).notNull(),
  payload: jsonb("payload").notNull(),
  errorMessage: text("error_message"),
  retriedCount: integer("retried_count").notNull().default(0),
  lastRetriedAt: timestamp("last_retried_at", { withTimezone: true }),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ DEVICE LOGS ============
export const deviceLogs = pgTable("device_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").references(() => devices.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id"),
  tenantId: uuid("tenant_id"),
  level: varchar("level", { length: 20 }).notNull(),
  service: varchar("service", { length: 60 }),
  event: varchar("event", { length: 120 }),
  errorCode: varchar("error_code", { length: 80 }),
  message: text("message"),
  metadata: jsonb("metadata"),
  sessionId: uuid("session_id"),
  requestId: varchar("request_id", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  deviceIdx: index("devlog_device_idx").on(t.deviceId),
  boothIdx: index("devlog_booth_idx").on(t.boothId),
  createdIdx: index("devlog_created_idx").on(t.createdAt),
}));

// ============ CAMERA COMPATIBILITY ============
export const cameraCompatibility = pgTable("camera_compatibility", {
  id: uuid("id").primaryKey().defaultRandom(),
  brand: varchar("brand", { length: 40 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  family: varchar("family", { length: 80 }),
  sdk: varchar("sdk", { length: 80 }),
  sdkVersion: varchar("sdk_version", { length: 40 }),
  connection: varchar("connection", { length: 40 }),
  remoteCapture: boolean("remote_capture").notNull().default(false),
  liveView: boolean("live_view").notNull().default(false),
  recommended: boolean("recommended").notNull().default(false),
  minimumFirmware: varchar("minimum_firmware", { length: 40 }),
  notes: text("notes"),
  knownIssues: text("known_issues"),
  status: cameraStatusEnum("status").notNull().default("EXPERIMENTAL"),
  supportedSince: timestamp("supported_since", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  brandModelIdx: uniqueIndex("cam_brand_model_idx").on(t.brand, t.model),
  statusIdx: index("cam_status_idx").on(t.status),
}));

// ============ SESSIONS ============
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  deviceId: uuid("device_id"),
  state: varchar("state", { length: 40 }).notNull(),
  actor: varchar("actor", { length: 40 }),
  enterAt: timestamp("enter_at", { withTimezone: true }).notNull().defaultNow(),
  exitAt: timestamp("exit_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  retryCount: integer("retry_count").notNull().default(0),
  errorCode: varchar("error_code", { length: 80 }),
  metadata: jsonb("metadata"),
}, (t) => ({
  trxIdx: index("session_trx_idx").on(t.transactionId),
  boothIdx: index("session_booth_idx").on(t.boothId),
  stateIdx: index("session_state_idx").on(t.state),
}));

// ============ CUSTOMERS ============
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  name: varchar("name", { length: 150 }),
  totalPhotos: integer("total_photos").notNull().default(0),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
  consentShowcase: boolean("consent_showcase").notNull().default(false),
  consentMarketing: boolean("consent_marketing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tenantEmailIdx: uniqueIndex("customer_tenant_email_idx").on(t.tenantId, t.email),
}));

// ============ DOWNLOAD TOKENS ============
export const downloadTokens = pgTable("download_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ipAddress: varchar("ip_address", { length: 60 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============ RELATIONS ============
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  booths: many(booths),
  outlets: many(outlets),
  frames: many(frames),
  transactions: many(transactions),
  subscriptions: many(b2bSubscriptions),
}));

export const boothsRelations = relations(booths, ({ one, many }) => ({
  tenant: one(tenants, { fields: [booths.tenantId], references: [tenants.id] }),
  outlet: one(outlets, { fields: [booths.outletId], references: [outlets.id] }),
  packages: many(packages),
  transactions: many(transactions),
  frames: many(boothFrames),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  booth: one(booths, { fields: [transactions.boothId], references: [booths.id] }),
  tenant: one(tenants, { fields: [transactions.tenantId], references: [tenants.id] }),
  package: one(packages, { fields: [transactions.packageId], references: [packages.id] }),
}));
```

### 10.13 API Error Standard
```json
{
  "success": false,
  "error": {
    "code": "DEVICE_ALREADY_PAIRED",
    "message": "Device sudah terhubung ke booth lain.",
    "requestId": "req_01HX...",
    "developerMessage": "booth.device_fingerprint conflicts with existing record id=...",
    "retryable": false
  }
}
```

Status: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found, juga untuk cross-tenant), 409 (conflict), 422 (unprocessable), 429 (rate limit), 500 (server), 503 (maintenance).

### 10.14 Variables Lingkungan (`.env.example`)
```env
# ===== PUBLIC (boleh ke browser) =====
NEXT_PUBLIC_APP_URL=https://snapbox.id
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=snapbox.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=snapbox
NEXT_PUBLIC_FIREBASE_APP_ID=1:xxx:web:xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# ===== SERVER_ONLY =====
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
DATABASE_URL=postgresql://postgres.xxx:password@host:5432/postgres
FIREBASE_ADMIN_PROJECT_ID=snapbox
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@snapbox.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ===== ENCRYPTION =====
ENCRYPTION_MASTER_KEY=base64_32_bytes_random
PAIRING_TOKEN_SECRET=base64_random_for_hmac
LAN_JWT_SECRET=base64_random_for_lan_jwt
DEVICE_JWT_SECRET=base64_random_for_device_session

# ===== THIRD_PARTY (server only) =====
PAKASIR_B2B_API_KEY=xxx
PAKASIR_B2B_WEBHOOK_SECRET=xxx
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="SnapBox <noreply@snapbox.id>"
SENTRY_AUTH_TOKEN=xxx
SENTRY_ORG=snapbox
SENTRY_PROJECT=snapbox-web

# ===== CLOUDFLARE =====
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ZONE_ID=xxx
TURNSTILE_SECRET_KEY=xxx
NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxx

# ===== LINKS =====
WHATSAPP_SALES_NUMBER=6281234567890
```

- **PUBLIC**: boleh exposed ke browser (dengan prefix `NEXT_PUBLIC_`).
- **SERVER_ONLY**: hanya server, DILARANG masuk bundle client.
- **SECRET/ENCRYPTION**: secret manager, DILARANG commit, rotasi berkala.
- **THIRD_PARTY**: server-only, rotasi per kuartal.

### 10.15 Cost Architecture (Estimasi per Skala)

| Skala | DB (Supabase) | Storage | Realtime | Cloudflare | Vercel | Firebase | Sentry | Estimasi Total/bulan |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 booth | Free/Pro $25 | 5 GB $0.10 | 10 conn | Free/$20 | Pro $20 | Free | Free | **~$65** |
| 100 booth | Pro $25 | 50 GB $1 | 100 conn | Pro $20 | Pro $20 | Free | Team $26 | **~$92** |
| 500 booth | Team $599 | 250 GB $5 | 500 conn | Business $200 | Pro $20 | Free | Team $26 | **~$850** |
| 1.000 booth | Team $599 | 500 GB $10 | 1.000 conn | Business $200 | Enterprise $500+ | Blaze ~$50 | Business $80 | **~$1.439** |

> **NEED CURRENT VENDOR PRICING VERIFICATION**: Harga vendor berubah. Wajib verifikasi pricing terbaru Supabase, Vercel, Cloudflare, Firebase, Sentry sebelum commit budget.

Cost drivers: DB, Storage, Bandwidth, Image processing, Realtime connections, Cloudflare, Vercel, Firebase, Sentry, Email, Payment gateway fee (2.9% + Rp 2.000 Midtrans), Desktop distribution.

### 10.16 Architecture Decision Records (ADR)

**ADR-001 — Secure Device Pairing (Bukan Pairing Code 6 Karakter Legacy)**
- **Context**: Requirement awal menyebut pairing code 6 karakter. Brute-force 6 karakter alfanumerik rentan (36^6 = 2.1 miliar kombinasi, feasible untuk brute force bila tanpa rate limit).
- **Options**: (A) 6-karakter code only, (B) QR + short-lived JWT, (C) Kombinasi QR + manual code + device fingerprint.
- **Decision**: **(C)** — QR + manual code (dengan hashing server + rate limit 5 attempt/menit + lockout 300 detik + expiry 10 menit + one-time). Device fingerprint bind seperti identitas tambahan.
- **Reason**: QR menghilangkan typing error; manual code tetap tersedia sebagai fallback dengan perlindungan berlapis.
- **Trade-offs**: Kompleksitas implementasi naik (~30%).
- **Impact**: Semua flow pairing mengikuti mekanisme baru; pairing code legacy deprecated.

**ADR-002 — Server as Source of Truth untuk Payment Status**
- **Context**: Client kiosk (React) bisa saja mengubah state `PAID` di memory.
- **Decision**: Hanya webhook (server-verified signature) yang boleh mengubah `transactions.payment_status = PAID`. Kiosk menerima event `PAYMENT_PAID` via Realtime.
- **Impact**: Kiosk DILARANG membuat keputusan capture tanpa event server.

**ADR-003 — Encryption Password & Secret Key Payment**
- **Context**: Owner menyimpan API key per provider di DB.
- **Decision**: AES-256-GCM dengan `ENCRYPTION_MASTER_KEY` rotasi per kuartal. Decryption hanya server-side saat create payment.
- **Impact**: DB compromise tidak langsung bocor credentials.

**ADR-004 — Tenant Isolation via RLS + Service Layer Authorization**
- **Context**: Multi-tenant SaaS.
- **Decision**: Dua lapisan — Service layer verify `session.tenant_id === resource.tenant_id` + Postgres RLS policy.
- **Impact**: Cross-tenant IDOR tertutup di dua level.

**ADR-005 — Single Source of Truth Config Hierarchy**
- **Context**: Konfigurasi kiosk bisa muncul di banyak tempat.
- **Decision**: Hierarki tegas: `Global defaults → Tenant theme → Booth override → Device runtime configuration`. Hanya ada satu tempat menyimpan konfigurasi per level.
- **Impact**: Tidak ada duplikasi config; perubahan selalu lewat version + Realtime.

**ADR-006 — Offline Payment DILARANG Client-side**
- **Context**: Internet mati di booth.
- **Decision**: Payment online DILARANG offline. Tunai tetap OK manual (staff catat via konsol). Jangan pernah client-side mark PAID.
- **Impact**: Graceful degradation jelas: capture/print tetap jalan untuk transaksi yang sudah PAID.

**ADR-007 — Kiosk Lockdown Multi-Layer**
- **Context**: Kiosk harus sulit keluar.
- **Decision**: 3 layer — Application Lock (Tauri + Windows API hook), OS Kiosk Policy (Windows Assigned Access/MDM), Physical Security. Documented explicitly.
- **Impact**: Tidak ada klaim security yang mustahil.

**ADR-008 — Preview vs Live View Mode Kamera**
- **Context**: DSLR berbeda dengan webcam di SDK.
- **Decision**: `CameraAdapter` expose `getStatus().liveViewAvailable`. UI menyesuaikan. Untuk DSLR tanpa live view → fallback ke shutter-only + preview setelah capture.
- **Impact**: UX adaptif per kamera.

**ADR-009 — Loading Kamera Compatibility Registry dari DB**
- **Context**: 145+ kamera, sering update.
- **Decision**: Tabel `camera_compatibility` + seeding + admin UI untuk update status (SUPPORTED/LIMITED/EXPERIMENTAL/NOT_SUPPORTED/DEPRECATED).
- **Impact**: Public page `/kamera` selalu sync dengan status real, bukan klaim statis.

**ADR-010 — Email Invite Wajib untuk Account Creation**
- **Context**: Tidak ada self-registration.
- **Decision**: Firebase Admin SDK create user without password + set-password link email via Resend.
- **Impact**: Kontrol penuh CEO atas akuisisi tenant.

**ADR-011 — Realtime Channel Naming Convention**
- **Decision**: `booth:{boothId}`, `tenant:{tenantId}`, `user:{userId}`, `broadcast:all`. Semua event payload punya `event_id` + `version`. Handler idempotent.
- **Impact**: Skalabilitas realtime terukur; konsisten dengan Supabase Realtime.

**ADR-012 — Print Job ID untuk Prevent Duplicate Print**
- **Decision**: Setiap print punya `print_job_id` (UUID) yang dikirim ke spooler + dikembalikan; server cek uniqueness sebelum decrement paper.
- **Impact**: Duplicate print dihindari.

**ADR-013 — Attract Mode Slideshow Menggunakan Consent Flag**
- **Decision**: Hanya foto dengan `customer_consent_showcase = true` yang masuk slideshow.
- **Impact**: Compliance privasi.

**ADR-014 — Local Storage Lifecycle Wajib Verification Sebelum Delete**
- **Decision**: File lokal baru dihapus setelah upload VERIFIED + print COMPLETED (atau RETENTION timer).
- **Impact**: Tidak ada photo loss.

**ADR-015 — Windows Service Conflict Handling dengan Whitelist**
- **Context**: WIA, Canon EOS Utility, Nikon NX Tether, Sony Imaging Edge.
- **Decision**: Hanya service dalam whitelist yang boleh di-remediate. Setiap remediation = confirmation + audit + privilege check. DILARANG arbitrary kill.
- **Impact**: Operator tidak merusak OS.

**ADR-016 — Single Instance BoxOS**
- **Decision**: OS-level single-instance lock (Named Mutex Windows, file lock Linux dengan flock).
- **Impact**: Tidak ada konflik hardware access.

**ADR-017 — Virtual Keyboard Kiosk-first**
- **Decision**: VirtualKeyboard React component dengan layout Indonesia + numeric + JSON-driven. Wajib muncul untuk input user.
- **Impact**: Kiosk tidak butuh keyboard fisik.

---

## 11. Tahapan Pengerjaan & Task Breakdown (Phased Execution)
*Mode eksekusi: **PHASE** (per Fase / Milestone). AI Coding Assistant wajib menyelesaikan 1 Fase penuh sebelum melapor dan menunggu konfirmasi user untuk lanjut ke fase berikutnya.*

### Prinsip Eksekusi Fase
- Setiap Fase = milestone mandiri dengan deliverable jelas.
- AI berhenti di akhir Fase, laporkan hasil + acceptance check, tunggu user konfirmasi.
- Setiap task merinci file/folder konkret, route, tabel DB, endpoint API, komponen UI.
- Setiap Fase punya Definition of Done (lihat Bab 11.11).

---

### Fase 0: Fondasi Arsitektur & Infrastruktur
*Tujuan: Setup project skeleton, design system, CI/CD, konfigurasi Supabase + Firebase + Cloudflare + Sentry. Belum ada fitur bisnis.*

- [ ] **Task 0.1 (Repo & Tooling)**: Init monorepo (`apps/web` Next.js 15, `apps/desktop` Tauri v2, `packages/db` Drizzle schema, `packages/ui` shared components). Setup TypeScript strict, ESLint, Prettier, Husky pre-commit, commitlint.
- [ ] **Task 0.2 (Design System Foundations)**: Setup Tailwind v4 + CSS variable token warna (yellow `#FFDD00`, violet `#8B5CF6`, pink `#FF1F8F`, ink `#141414`, warm white `#FFFEF5`). Install `neobrutalism-components`, `shadcn/ui`, `lucide-react`, `framer-motion`, `recharts`, `react-hook-form`, `zod`, `react-dropzone`, `react-colorful`. Build base components: Button, Card, Input, Dialog, Table, Badge, Tabs, Alert, Select, Progress, Slider, Tooltip, DropdownMenu, Accordion.
- [ ] **Task 0.3 (Font & Layout Primitives)**: Load Space Grotesk + Inter + JetBrains Mono. Setup root layout, theme provider, toast provider, motion wrapper.
- [ ] **Task 0.4 (Supabase Setup)**: Create project Supabase, enable Realtime, RLS, Storage bucket policy draft (`frames`, `branding`, `attract`, `soft-copies`, `reports`, `logs`), pg_cron enabled.
- [ ] **Task 0.5 (Firebase Setup)**: Firebase project, Email/Password auth enabled, Admin SDK credential generated, custom claims schema documented.
- [ ] **Task 0.6 (Sentry + Vercel + Cloudflare)**: Deploy dummy Next.js to Vercel, Cloudflare DNS pointing, WAF rule draft, Turnstile site key. Sentry project created (web + desktop source maps).
- [ ] **Task 0.7 (CI/CD Skeleton)**: GitHub Actions workflow: `lint`, `typecheck`, `test`, `build`, preview deploy. Tauri build workflow draft (Windows NSIS, Linux `.deb`).
- [ ] **Task 0.8 (Drizzle Base & Migration Harness)**: Init `packages/db`, `drizzle.config.ts`, migration script, seed script placeholder. Setup Supabase connection pooler.
- [ ] **Task 0.9 (Env Vault & Secret Strategy)**: Buat `.env.example` (Bab 10.14), setup Vercel env, Supabase secret, GitHub Action secrets, dokumentasi rotasi.

**Acceptance Fase 0**: Repo build hijau, dummy page render di Vercel, Supabase + Firebase reachable, CI pass, Sentry capture test error.

---

### Fase 1: Public Website + Auth + Tenant + Subscription Engine
*Tujuan: Landing page publik, login Firebase, provisioning tenant (Super Admin), subscription engine B2B (Pakasir), Super Admin Dashboard dasar, Feature Entitlement System.*

- [ ] **Task 1.1 (Landing Page)**: Wire `/`, `/tentang`, `/fitur`, `/harga`, `/kamera`, `/kontak`, `/docs/troubleshooting`, `/unduh-aplikasi`. Layout public (Header + Footer 4px border). Hero neobrutalism + stagger text + gradient sengaja. Section fitur, showcase frame (dummy), 3 paket harga, marquee logo tenant, testimoni, FAQ accordion, CTA "Konsultasi Gratis" (WhatsApp). Footer sitemap + legal. SEO metadata + OG + JSON-LD (`Organization`, `Product`, `FAQPage`) + sitemap + robots.
- [ ] **Task 1.2 (Auth Pages & Flow)**: `/login` (form Email & Password neobrutalism, mode toggle untuk Staff PIN), `/unauthorized`. Firebase Client SDK login → verify server via `firebase-admin`. Middleware `middleware.ts` (edge) redirect by custom claim + subscription check. Session cookie secure HttpOnly SameSite=Lax.
- [ ] **Task 1.3 (Super Admin Dashboard Skeleton)**: Layout `/ceo-dashboard` + sidebar + header. Route placeholder yang benar-benar punya konten dummy (bukan "sedang dikembangkan"): `dashboard`, `tenants`, `subscriptions`, `plans`, `devices`, `broadcast`, `activity-log`, `promos`, `settings`, `system-health`, `security`.
- [ ] **Task 1.4 (Tenant Provisioning Wizard)**: `/ceo-dashboard/tenants` (tabel 20 tenant dummy dengan filter), `/ceo-dashboard/tenants/new` (wizard 3 langkah: Client Details → Plan & Duration → Review & Invite), `/ceo-dashboard/tenants/[id]` (detail + suspend/ban/reset/downgrade/restore dengan confirmation + reason). Server Action `createTenant` (Firebase Admin SDK + insertion `users`, `tenants`, `b2b_subscriptions`, `booths` default) + Resend invite email.
- [ ] **Task 1.5 (Plan Editor)**: `/ceo-dashboard/plans` — edit harga/limit/fitur per plan. Server Action update `plans`. Feature Entitlement table editable.
- [ ] **Task 1.6 (Subscription Engine B2B - Draft)**: `/ceo-dashboard/subscriptions` tabel invoice Pakasir B2B dummy + filter status. Server action draft `createInvoice`, `retryInvoice`. Integrasi API Pakasir B2B (sandbox) + webhook endpoint `/api/webhooks/pakasir-b2b` draft (verifikasi HMAC-SHA256 stub).
- [ ] **Task 1.7 (Feature Entitlement System)**: Buat service `EntitlementService` dengan method `checkEntitlement(tenantId, feature): EntitlementResult`. Map limit dari `plans.features` JSONB + add-on. Wajib dipakai di seluruh codebase, DILARANG `if (plan === "GROWTH")` tersebar.
- [ ] **Task 1.8 (Audit Log Foundation)**: Instal `activity_logs` write helper. Wrap high-risk action untuk CEO (create/suspend/ban/delete tenant, change pricing) dengan audit otomatis.
- [ ] **Task 1.9 (Broadcast + Settings CEO)**: `/ceo-dashboard/broadcast` kirim ke semua/tenant terpilih. `/ceo-dashboard/settings` pengaturan global (WhatsApp number, email template, feature flag).
- [ ] **Task 1.10 (Global Promo CEO)**: `/ceo-dashboard/promos` CRUD voucher platform-wide, aktif/nonaktif, kuota.
- [ ] **Task 1.11 (System Health & Security)**: `/ceo-dashboard/system-health` (status sentry, webhook queue, cron status), `/ceo-dashboard/security` (login gagal, rate limit hits, WAF events).
- [ ] **Task 1.12 (Database Migrations - Auth & Tenant)**: Migrations untuk `users`, `tenants`, `plans`, `b2b_subscriptions`, `activity_logs`, `notifications`, `broadcasts`, `promos`. RLS policy untuk tenant tables. Seed plan 3 tier + 3 tenant sample.

**Acceptance Fase 1**: CEO bisa login, buat tenant baru (invite email terkirim), edit plan, lihat audit log. Landing page SEO + OG render benar. Middleware redirect bekerja untuk CEO/Owner/Staff.

---

### Fase 2: Owner Dashboard Lengkap (UI First, Data Dummy + Binding Partial)
*Tujuan: Seluruh dashboard Owner lengkap secara UI, sebagian sudah terhubung dengan DB (outlets, machines, packages). Frame Studio, Templates, Kiosk Theme, Promo, Payment, Staff, Analytics, Reports, Subscription UI complete.*

- [ ] **Task 2.1 (Owner Dashboard Layout)**: Sidebar + header dengan plan badge, quota indicator, notif bell. Route groups: `dashboard`, `outlets`, `machines`, `devices`, `frame-studio`, `templates`, `packages`, `kiosk-theme`, `promos`, `payment-settings`, `staff`, `customers`, `transactions`, `finance`, `analytics`, `reports`, `subscription`, `notifications`, `settings`.
- [ ] **Task 2.2 (Outlets CRUD)**: `/owner-dashboard/outlets` + `[id]` detail — Server Actions CRUD `outlets`, validation Zod, tenant-scoped.
- [ ] **Task 2.3 (Machine Manager)**: `/owner-dashboard/machines` daftar booth realtime + `[boothId]` detail (harga per booth, paper count, maintenance mode, PIN Lock toggle). Server Action `booths.update`. Tambah `Add New Device` → generate pairing code + QR preview (draft API `/api/booth/pair-session`).
- [ ] **Task 2.4 (Device & Add-On Manager)**: `/owner-dashboard/devices` daftar device paired, revoke (draft), kuota add-on, renewal, upgrade add-on.
- [ ] **Task 2.5 (Frame Studio)**: `/owner-dashboard/frame-studio` — upload drag-drop (`react-dropzone`), validation (max 5MB, min 800×600, MIME PNG/JPG), preview checkerboard, color picker chroma (`react-colorful`), tolerance slider 5–40, assign booth, toggle active. Server Actions `frames.create/update/delete`, storage upload ke Supabase bucket `frames`, generate thumbnail.
- [ ] **Task 2.6 (Templates)**: `/owner-dashboard/templates` — CRUD template preset (single, strip 2x6, kolase 4-pose, custom). Server Actions CRUD.
- [ ] **Task 2.7 (Packages)**: `/owner-dashboard/packages` — CRUD paket per booth dengan retake limit, pose count, print size, includeGif.
- [ ] **Task 2.8 (Kiosk Theme Customizer)**: `/owner-dashboard/kiosk-theme` — editor (logo, warna, font, welcome, attract, CTA, panel style, orientation, PIN Lock) + live preview mock. Validation kontras 4.5:1 server-side. Version history (max 5). Publish → Realtime event `THEME_UPDATED` (draft integrasi).
- [ ] **Task 2.9 (Promo & Voucher)**: `/owner-dashboard/promos` — CRUD voucher, batch generate (max 500, CSV download), tracking redemption. Server Action `promos.*` + `redeemPromo` (atomic).
- [ ] **Task 2.10 (Payment Gateway Config)**: `/owner-dashboard/payment-settings` — pilih provider, input API key + secret masked, sandbox/production, primary/backup, test connection. Server Action enkripsi AES-256-GCM + `b2c_payment_configs` upsert.
- [ ] **Task 2.11 (Staff Management)**: `/owner-dashboard/staff` — CRUD staff + invite Firebase Admin + deactivate. Kuota staff dari Entitlement.
- [ ] **Task 2.12 (Customer CRM)**: `/owner-dashboard/customers` — tabel customer unik + total foto/spent/last visit, masking email untuk staff.
- [ ] **Task 2.13 (Transactions)**: `/owner-dashboard/transactions` — tabel 100+ transaksi dummy + filter status/method/date/booth + bulk ZIP + export CSV.
- [ ] **Task 2.14 (Finance & Analytics)**: `/owner-dashboard/finance` + `/owner-dashboard/analytics` — Recharts line + pie + funnel + retention. Dummy data terstruktur.
- [ ] **Task 2.15 (Reports)**: `/owner-dashboard/reports` — jadwal report + export PDF/CSV.
- [ ] **Task 2.16 (Subscription Owner)**: `/owner-dashboard/subscription` — status Pakasir B2B, tanggal expired, tombol perpanjang, histori invoice, upgrade/downgrade, add-on. Checkout flow (draft).
- [ ] **Task 2.17 (Notifications Owner + Settings)**: `/owner-dashboard/notifications` + `/owner-dashboard/settings` + `/owner-dashboard/support`.
- [ ] **Task 2.18 (Staff Dashboard)**: `/staff-dashboard/*` — read-only monitoring, tombol destructive disabled.
- [ ] **Task 2.19 (Database Migrations - Owner)**: Migrations untuk `outlets`, `booths`, `devices`, `pairing_tokens`, `device_calibrations`, `frames`, `frame_versions`, `booth_frames`, `templates`, `packages`, `kiosk_themes`, `kiosk_theme_versions`, `promos`, `promo_redemptions`, `b2c_payment_configs`, `transactions`, `paper_logs`, `customers`, `download_tokens`, `sessions`, `webhook_events`, `webhook_failures`, `device_logs`, `camera_compatibility`. RLS semua.

**Acceptance Fase 2**: Owner bisa navigasi seluruh dashboard, CRUD outlets/packages/frames/promos/staff, lihat analytics dummy. RLS tenant isolation tested (attempt cross-tenant akses = 404).

---

### Fase 3: Device Pairing, Realtime Sync, dan Konsol Perangkat Web
*Tujuan: Secure pairing, heartbeat, revoke, realtime config sync ke desktop, dan konsol perangkat web fallback.*

- [ ] **Task 3.1 (Pairing Session API)**: `POST /api/booth/pair-session` (Owner) generate pairing token (JWT HMAC, hash server-side, expiry 10 menit, one-time). Return `qr_url` + `manual_code`. Audit.
- [ ] **Task 3.2 (Pairing Consume API)**: `POST /api/booth/pair` — verify hash + fingerprint, insert `devices`, update `booths`, issue `session_jwt` (30d). Return `{booth_id, session_jwt, booth_config, kiosk_theme}`. Rate limit 5 attempt/menit. Audit `DEVICE_PAIRED`.
- [ ] **Task 3.3 (Heartbeat API)**: `POST /api/booth/heartbeat` — verifikasi JWT + fingerprint. Update `booths.last_heartbeat_at` + `paper_count` + status. Emit Realtime `BOOTH_ONLINE` bila sebelumnya OFFLINE. Cron 60s cek booth tanpa heartbeat > 90s → `BOOTH_OFFLINE` + notif Owner.
- [ ] **Task 3.4 (Revoke API)**: `POST /api/booth/revoke` — set `devices.is_revoked=true`, `booths.status=UNPAIRED`, `device_fingerprint=null`, emit `DEVICE_REVOKED` realtime. Audit.
- [ ] **Task 3.5 (Realtime Config Sync)**: Setup Supabase Realtime channel subscription di Server (broadcast via service role). Trigger pada perubahan `booths`, `kiosk_themes`, `packages`, `frames`, `promos` → emit `CONFIG_UPDATED` ke `booth:{id}` dengan `config_version`.
- [ ] **Task 3.6 (Konsol Perangkat Web Base)**: `/owner-dashboard/devices/[boothId]/diagnostics` + 5 tab. Status visual (CONNECTED/WARNING/ERROR/OFFLINE/SYNCING/NOT CONFIGURED/REVOKED) dengan icon + label + tooltip (tidak warna saja).
- [ ] **Task 3.7 (Kamera Tab Web)**: Scan camera via bridge agent (Opsional: Desktop API tauri commands, Web read-only fallback), kalibrasi (mirror/rotate/zoom per device).
- [ ] **Task 3.8 (Printer Tab Web)**: Pilih printer default, paper profile, test print (queue async), spooler status.
- [ ] **Task 3.9 (Operator Tab Web)**: Generate QR operator (JWT 15 menit, LAN-only IP check, one-time), daftar sesi operator, tombol Disconnect/Revoke dengan confirmation + reason + audit.
- [ ] **Task 3.10 (Sistem Tab Web)**: Versi app, OS services, orientation, kiosk style, WIA conflict detection.
- [ ] **Task 3.11 (Riwayat Tab)**: Sessions, application logs, hardware logs, sync history, print jobs, camera events. Filter by level, download `.log`.
- [ ] **Task 3.12 (Worker Queue + Dead Letter)**: Setup queue untuk webhook + async jobs (Supabase cron + handler). `webhook_failures` populate on failure.

**Acceptance Fase 3**: Owner bisa pairing desktop Tauri (via Fase 4), konsol web menampilkan data device + diagnostics. Cross-tenant pairing/revoke tidak bisa. Config sync realtime terbukti (edit theme → device apply event < 2s).

---

### Fase 4: Tauri Desktop Kiosk — Hardware Engine
*Tujuan: Aplikasi Tauri v2 lengkap dengan hardware abstraction, camera engine (Canon/Nikon/Sony/Webcam), printer engine (Windows spooler/DNP/Epson/Canon), diagnostics native.*

- [ ] **Task 4.1 (Tauri Scaffold)**: Init `apps/desktop` Tauri v2 + React frontend (reuse dari `apps/web` atau separate). Setup secure storage (Windows DPAPI / Linux Secret Service), single-instance lock, auto-start Windows service.
- [ ] **Task 4.2 (Rust Command Layer - Base)**: `device.get_fingerprint`, `device.store_session`, `device.read_session`, `device.wipe_session`, `app.get_info`. Typed error handling. Log structured.
- [ ] **Task 4.3 (Hardware Adapter Traits)**: Define `CameraAdapter`, `PrinterAdapter`, `StorageAdapter` di Rust. Register di `AppState`.
- [ ] **Task 4.4 (Webcam Adapter)**: Windows Media Foundation / V4L2 (Linux) preview + capture. Live view via webview.
- [ ] **Task 4.5 (Canon Adapter)**: Integrasi `snapbox-camera` Rust crate (Canon EDSDK wrapper). Command: scan, connect, capture, setMode, setZoom, getStatus. Tether mode JPEG L, auto power off handling.
- [ ] **Task 4.6 (Nikon Adapter)**: PTP/MTP. Similar command set. Conflict detection (NX Tether, Camera Control Pro).
- [ ] **Task 4.7 (Sony Adapter)**: Sony Camera Remote SDK. Command set. USB PC Remote mode detection.
- [ ] **Task 4.8 (Windows Spooler Printer Adapter)**: Windows print API, paper profile (4×6, 4×6 split 2, 2×6), print job ID (dedupe), spooler monitor.
- [ ] **Task 4.9 (DNP / Epson / Canon Printer Adapter)**: Specific paper + cut mode handling. Fallback ke spooler bila driver-specific feature tidak tersedia.
- [ ] **Task 4.10 (Pairing UI Tauri)**: Welcome screen "Belum terhubung" + Konsol Perangkat (`tap 5 corners` / `hold Space+V` 5s) → PIN admin → tab Operator → input pairing code / scan QR. Cek berhasil → simpan JWT ke secure storage → subscribe Realtime.
- [ ] **Task 4.11 (Config Sync & Heartbeat)**: Fetch config on boot + on Realtime event. Heartbeat 30s (atau 15s Growth/Enterprise). Last known good config storage + rollback on corrupt update.
- [ ] **Task 4.12 (Konsol Perangkat Tauri - 5 Tab)**: Status, Kamera (scan + calibrate), Printer (scan + test print), Operator (QR generate + disconnect), Sistem (app info, OS services, WIA, orientation, style), Riwayat (sessions, logs).
- [ ] **Task 4.13 (Camera Troubleshooting Wizard)**: 3-step (USB data cable → USB mode PC/PTP → Camera software conflict detection). Brand-specific checklist (Canon: Wi-Fi/NFC disable, EOS Utility close, JPEG L, auto power off. Nikon, Sony, Webcam).
- [ ] **Task 4.14 (Service Conflict Remediation)**: Detect Canon EOS Utility / Nikon NX Tether / Sony Imaging Edge / WIA. Whitelist stop service action dengan confirmation + audit + privilege check.
- [ ] **Task 4.15 (Camera Compatibility Registry)**: Public page `/kamera` fetch dari `camera_compatibility`. Admin UI untuk update status.
- [ ] **Task 4.16 (Auto-start & Boot Health Check)**: SnapBox service + Tauri app boot flow → device auth → subscription check → hardware scan → sync → health check → Kiosk Ready / Safe Recovery Screen.
- [ ] **Task 4.17 (Low Storage Protection)**: Thresholds (NORMAL/WARNING/CRITICAL/BLOCK). Display di Konsol Perangkat.

**Acceptance Fase 4**: Desktop app install di Windows + Linux, pairing sukses, capture dari Canon/Nikon/Sony/Webcam, print via spooler/DNP, konsol diagnosik native lengkap, upgrade config dari web sync < 2s.

---

### Fase 5: Customer Kiosk Flow
*Tujuan: Seluruh customer journey — attract, guide, packages, voucher, payment, capture, filter, chroma, composite, retake, print, soft copy, PIN Lock.*

- [ ] **Task 5.1 (State Machine Engine)**: Implement state machine (Fase R di Bab 6). Persist state ke SQLite local. Recovery on crash/power loss.
- [ ] **Task 5.2 (Attract Mode)**: Video lokal loop + slideshow dari transaksi consent + overlay "SENTUH UNTUK MULAI". Idle detection 30s. Hidden skip button.
- [ ] **Task 5.3 (Pre-Payment Guide + Package Selection)**: Guide 3 langkah (configurable Owner) + kartu paket dari `packages` per booth.
- [ ] **Task 5.4 (Voucher Input + Virtual Keyboard)**: VirtualKeyboard React (min 120×120 px per tombol, alfabetis + numpad, uppercase, backspace besar + OK). Validasi server `/api/voucher/validate`.
- [ ] **Task 5.5 (Payment Screen + Webhook Integration)**: `POST /api/payment/create` (per provider adapter). Render QR 5 menit / instruksi tunai / konfirmasi voucher. Poll + Realtime `PAYMENT_PAID`. Capture block kecuali event server.
- [ ] **Task 5.6 (Payment Provider Adapters)**: `MidtransAdapter`, `XenditAdapter`, `DokuAdapter`, `PakasirAdapter` implement `PaymentProvider`. Webhook handlers `/api/webhooks/b2c/[provider]` dengan verifikasi signature spec-compliant.
- [ ] **Task 5.7 (PIN Lock)**: Enable Windows API hook (disable Alt+F4, Win key, Alt+Tab, Esc) selama sesi capture. Recovery path PIN admin. Nonaktif setelah print sukses.
- [ ] **Task 5.8 (Capture Flow)**: Countdown 3-2-1 → capture via camera adapter (DSLR / webcam). Live preview overlay frame. Retake loop (limit dari package).
- [ ] **Task 5.9 (Filter & Adjust)**: Grid filter preview (6–12), slider zoom (1.0–2.5×), slider scale (0.8–1.2×), drag position. Preview apply.
- [ ] **Task 5.10 (Chroma Key + Composite)**: Web Worker + OffscreenCanvas. Algorithm: Input RGB → Target → Delta Threshold → Alpha Mask → Edge Refinement → Composite. Multi-layer Enterprise.
- [ ] **Task 5.11 (Photo Processing Pipeline)**: Generate raw JPG (< 500KB) + framed JPG (< 800KB) + animated GIF 10s (< 3MB). Upload ke Supabase Storage.
- [ ] **Task 5.12 (Auto Print + Decrement Paper)**: Rust `execute_print()` dengan print job ID. Decrement `paper_count` via API pada sukses. Retry 2×. Fallback soft copy.
- [ ] **Task 5.13 (Success Screen + QR Soft Copy)**: Generate token 32 char + signed URL + QR display. Link `/download/[token]`.
- [ ] **Task 5.14 (Download Inline)**: `/download/[token]` publik, verifikasi token 7 hari + single-use, tampilkan raw + framed + GIF.
- [ ] **Task 5.15 (Maintenance Mode)**: Overlay penuh saat subscription expired / revoked / maintenance. Kiosk tidak bisa start paid session.

**Acceptance Fase 5**: End-to-end: Attract → bayar QRIS Midtrans → capture → filter → composite → print → QR download. PIN Lock tested. Offline mode: capture dengan config cached, upload queue.

---

### Fase 6: Analytics, Finance, Reports, Notifikasi, Realtime Event Hardening
*Tujuan: Product analytics lengkap, event taxonomy, observability, hardening webhook/event idempotency.*

- [ ] **Task 6.1 (Event Taxonomy)**: Implement semua event: `landing_view`, `login_success`, `tenant_created`, `subscription_checkout_started`, `subscription_paid`, `booth_created`, `booth_paired`, `booth_online`, `booth_offline`, `package_selected`, `payment_started`, `payment_success`, `payment_failed`, `capture_started`, `capture_completed`, `retake`, `filter_applied`, `print_started`, `print_success`, `print_failed`, `download_started`, `download_completed`, `voucher_redeemed`. Store di warehouse/table.
- [ ] **Task 6.2 (Business Metrics)**: MRR, churn, ARPU, tenant growth, revenue per tenant. Source: `b2b_subscriptions`, `transactions`.
- [ ] **Task 6.3 (Operational Metrics)**: API latency (P50/P95/P99), webhook latency, realtime connection, error rate. Source: Sentry + custom logging.
- [ ] **Task 6.4 (Hardware Metrics)**: camera_capture_failure_rate, printer_failure_rate, offline_duration, avg_session_duration. Source: `sessions`, `device_logs`.
- [ ] **Task 6.5 (Finance Reports)**: Revenue daily/weekly/monthly + gateway fee reconciliation + refund. Export PDF/CSV.
- [ ] **Task 6.6 (Scheduled Reports)**: Cron generate + email via Resend (Owner dapat memilih jadwal).
- [ ] **Task 6.7 (Realtime Event Idempotency)**: Handler untuk setiap event type dengan `event_id` unique constraint + version check.
- [ ] **Task 6.8 (Notification Engine)**: Type + severity + title + message + metadata + read + expiry + tenant scope. Realtime push < 2 detik.
- [ ] **Task 6.9 (Notifications UI)**: Bell dropdown di header + halaman `/notifications` (Owner, Staff, CEO).
- [ ] **Task 6.10 (Broadcast CEO)**: Kirim notif realtime ke semua/tenant terpilih.
- [ ] **Task 6.11 (Low Paper Alert)**: Rule ≤ 20% → notif Owner email + in-app. ≤ 5% → alert besar + auto disable booth.

**Acceptance Fase 6**: 4 kategori metrics dipisah dan akurat. Reports email terkirim. Realtime event idempotent dan ordered.

---

### Fase 7: Security Hardening, Testing, & Compliance
*Tujuan: Tutup semua security gap, jalankan test suite lengkap (unit, integration, E2E, security, load, chaos).*

- [ ] **Task 7.1 (WAF + Rate Limit)**: Config Cloudflare WAF rules per endpoint. Turnstile pada contact. Rate limit `/auth` 10/min, `/payment/create` 30/min, `/booth` 60/min, `/webhooks` 300/min, `/contact` 5/jam.
- [ ] **Task 7.2 (Secret Rotation)**: Enkripsi payment key rotasi per kuartal. Device JWT secret rotation. Firebase service account rotation.
- [ ] **Task 7.3 (Encryption Audit)**: AES-256-GCM dipakai di semua credential. Verify no plaintext in DB/logs.
- [ ] **Task 7.4 (IDOR Test Suite)**: Automated test cross-tenant: coba akses resource tenant lain via manipulasi `tenant_id` di query/body/path → expect 404.
- [ ] **Task 7.5 (XSS/CSRF/SQL Injection Test Suite)**: Semua form + API. Payload injection attempts → block.
- [ ] **Task 7.6 (Webhook Forge & Replay Test)**: Test invalid signature, expired timestamp, duplicate id, out-of-order event.
- [ ] **Task 7.7 (Pairing Replay & Brute Force Test)**: Attack simulasi + rate limit + lockout verification.
- [ ] **Task 7.8 (Download Token Guess Test)**: Attest randomness, single-use, expiry.
- [ ] **Task 7.9 (Privilege Escalation Test)**: Staff coba akses Owner route, Owner coba akses CEO route, rent API.
- [ ] **Task 7.10 (Load Test)**: Simulasi 100/500/1.000 booth concurrent. Hasil: API P95 < 200ms, Webhook P95 < 500ms.
- [ ] **Task 7.11 (Chaos Test)**: Simulasi network failure, gateway failure, device disconnect, DB latency.
- [ ] **Task 7.12 (E2E Playwright)**: Full journey registration → tenant → booth → pair → customer → payment → capture → print → QR.
- [ ] **Task 7.13 (Hardware E2E Matrix Testing)**: Canon, Nikon, Sony, Webcam, DNP, Epson, Canon Printer — detect, preview, capture, print, failure recovery. Status TESTED/PARTIAL/BLOCKED per combo.
- [ ] **Task 7.14 (Accessibility Audit)**: WCAG 2.2 AA check semua halaman publik + dashboard + kiosk. axe-core integrated.
- [ ] **Task 7.15 (Observability Finalize)**: Sentry alerts, health check, dashboard metrics.

**Acceptance Fase 7**: Security checklist Bab 8.3 lulus 100%. Semua test suite hijau. Load test PASS.

---

### Fase 8: Deployment Production & Launch
*Tujuan: Go-live production, monitoring, runbook, onboarding tenant pertama.*

- [ ] **Task 8.1 (Production Env)**: Vercel production env + Supabase production tier + Firebase production + Cloudflare production zone + Sentry production.
- [ ] **Task 8.2 (Database Production Migration)**: RLS production + migrasi final + seed plans. Backup config daily + PITR.
- [ ] **Task 8.3 (Tauri Release)**: GitHub Actions release pipeline sign artifact → rilis di GitHub Releases + mirror di `/unduh-aplikasi` halaman download.
- [ ] **Task 8.4 (Runbook + Monitoring)**: Buat runbook: recovery, rollback, incident response, on-call, escalation matrix.
- [ ] **Task 8.5 (Backup & Disaster Recovery)**: Backup daily + PITR 7 hari + DR drill (restore to staging).
- [ ] **Task 8.6 (Data Retention Cron)**: Cron cleanup soft copy sesuai plan, cleanup download tokens, cleanup sessions, cleanup logs.
- [ ] **Task 8.7 (Legal & Compliance)**: Privacy policy, ToS, DPA, cookie consent.
- [ ] **Task 8.8 (Launch Checklist + Onboarding)**: Onboard 3 tenant pilot. Monitor 7 hari. Closing check + retrospective.

**Acceptance Fase 8**: Sistem live, tenant pilot onboarding sukses, monitoring terlihat, runbook lengkap.

---

### Fase 9: Post-Launch Iteration (Phase 2 Features — Opsional)
- Batch upgrade: AI enhancement foto, marketplace frame, white-label, multi-currency, reseller role, thermal printer integration.

---

### Definition of Done (Feature)
Sebuah feature dianggap selesai hanya jika:
- [ ] UI selesai
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Accessibility (WCAG 2.2 AA)
- [ ] Backend selesai
- [ ] Database migration selesai
- [ ] API selesai
- [ ] Validation selesai (Zod + server)
- [ ] Authorization selesai
- [ ] Security selesai
- [ ] Error handling selesai
- [ ] Loading state, empty state, skeleton state selesai
- [ ] Audit log selesai
- [ ] Analytics event selesai
- [ ] Realtime jika diperlukan
- [ ] Unit test, integration test, E2E jika relevan
- [ ] Documentation
- [ ] Acceptance criteria terpenuhi

---

## 12. Master Starter Prompt (Siap Coding untuk AI Agent)
*Salin prompt di bawah ini ke AI Coding Assistant (Google Antigravity / Cursor / Claude Code / GitHub Copilot / Roo Code / dll.) untuk memulai pengerjaan.*
```markdown
Halo! Kamu berperan sebagai Senior Fullstack Architect, Rust/Tauri Engineer, dan Lead Developer SnapBox Photobooth.

Saya ingin membangun aplikasi berdasarkan dokumen PRD ini (SnapBox Photobooth — Multi-Tenant SaaS + Desktop Tauri Kiosk).

Silakan baca file @PRD.md secara menyeluruh terlebih dahulu.

=== ATURAN EKSEKUSI (WAJIB DIPATUHI) ===

1. MODE EKSEKUSI = "PHASE" (Bertahap per Fase/Milestone).
   - Kamu WAJIB menyelesaikan SATU FASE penuh secara mandiri dalam satu putaran (contoh: seluruh Fase 0 dari Task 0.1 sampai Task 0.9 selesai).
   - Setelah Fase selesai, BERHENTI. Laporkan apa saja yang sudah dikerjakan + acceptance check Fase tersebut.
   - WAJIB MENUNGGU konfirmasi eksplisit dari saya sebelum melanjutkan ke Fase berikutnya.
   - DILARANG melompat antar fase.
   - DILARANG memulai Fase 1 sebelum Fase 0 dinyatakan selesai oleh saya.

2. JANGAN PERNAH membuat semua kode atau file sekaligus di luar scope fase yang diminta.

3. Setiap Task dalam Fase punya file/folder konkret, route, tabel DB, API endpoint, dan komponen UI yang harus kamu buat. Wajib spesifik, jangan generik.

4. SETIAP file yang dibuat WAJIB:
   - TypeScript strict + Zod validation.
   - Server-side authorization (tidak mempercayai client).
   - Tenant isolation (verifikasi session.tenant_id === resource.tenant_id).
   - Error handling + loading state + empty state + skeleton.
   - Accessible (WCAG 2.2 AA minimal).
   - Responsive (mobile/tablet/desktop).
   - Anti-AI-Slop UI sesuai Bab 4 PRD (neobrutalism, border 3–4px ink, hard shadow, Space Grotesk + Inter + JetBrains Mono).
   - Bebas "Halaman Placeholder" / "Sedang dalam pengembangan" — buat UI lengkap dengan data dummy Bahasa Indonesia yang relevan.

5. TECH STACK WAJIB DIPATUHI:
   - Web: Next.js 15 App Router + React 19 + TypeScript 5.x strict.
   - UI: Tailwind CSS v4 + neobrutalism-components + shadcn/ui + lucide-react + framer-motion + recharts + react-hook-form + zod + react-dropzone + react-colorful.
   - Auth: Firebase Authentication (Email & Password) + Firebase Admin SDK + custom claims (CEO/OWNER/STAFF/tenant_id).
   - DB: Supabase PostgreSQL + Drizzle ORM (schema di Bab 10.12).
   - Realtime: Supabase Realtime channel booth:{boothId}, tenant:{tenantId}, user:{userId}, broadcast:all.
   - Storage: Supabase Storage bucket frames, branding, attract, soft-copies, reports, logs.
   - Desktop: Tauri v2 + Rust 1.77+ + crate snapbox-camera (Canon EDSDK, Nikon PTP, Sony Camera Remote SDK) + snapbox-printer (Windows Spooler + CUPS).
   - Payment B2C: Midtrans (default), Xendit, Doku, Pakasir — via PaymentProvider interface (Owner configure sendiri sesuai docs masing-masing).
   - Payment B2B: Pakasir (subscription SaaS) — webhook HMAC-SHA256.
   - Email: Resend.
   - Cloudflare: DNS + WAF + Rate Limiting + Turnstile.
   - Monitoring: Sentry.

6. DILARANG KERAS:
   - Membuat fitur di luar PRD.
   - Mengarang API atau tabel database yang tidak ada di Bab 10.12.
   - Membuat mock backend sebagai production implementation.
   - Bypass authentication atau authorization.
   - Expose secret ke frontend (hanya NEXT_PUBLIC_* yang boleh masuk bundle client).
   - Hardcode pricing / tenant / subscription / payment status.
   - Mempercayai status PAID dari client (harus dari webhook server-verified).
   - Menggunakan Lorem Ipsum.
   - Membuat UI generik AI-slop.
   - Menambahkan dependency tanpa alasan jelas.
   - Membuat dua sumber kebenaran untuk state yang sama.
   - Menginstruksikan pembuatan "Halaman Placeholder".

7. WAJIB DIPATUHI:
   - TypeScript strict, Zod, server-side validation.
   - Server-side authorization, tenant isolation, IDOR prevention.
   - Audit logging untuk aksi high-risk (suspend/ban/delete/pricing/pairing/revoke/PIN change).
   - Analytics event untuk action penting.
   - Dokumentasi inline + JSDoc untuk public API.
   - Migrations via Drizzle terpisah dari kode aplikasi.
   - Realtime event idempotent (event_id + version).

8. SAAT MEMULAI FASE:
   - Bacakan ulang daftar task Fase tersebut.
   - Konfirmasi dependency (tabel, service, komponen) dari fase sebelumnya.
   - Konfirmasi tidak ada pekerjaan yang tumpang tindih.
   - Baru eksekusi.

9. SETELAH MENYELESAIKAN FASE:
   - Laporkan: Task selesai (checklist), File dibuat, Database migration dijalankan, Test yang dijalankan, Screenshot/screenshot-link UI jika relevan.
   - Laporkan acceptance check: PASS / FAIL dengan bukti.
   - Tanyakan apakah boleh lanjut ke fase berikutnya.

=== URUTAN FASE ===
Fase 0: Fondasi Arsitektur & Infrastruktur
Fase 1: Public Website + Auth + Tenant + Subscription Engine (Super Admin Dashboard)
Fase 2: Owner Dashboard Lengkap (UI + DB partial binding)
Fase 3: Device Pairing + Realtime Sync + Konsol Perangkat Web
Fase 4: Tauri Desktop Kiosk — Hardware Engine
Fase 5: Customer Kiosk Flow
Fase 6: Analytics + Finance + Reports + Notification + Realtime Hardening
Fase 7: Security Hardening + Testing (Unit/Integration/E2E/Security/Load/Chaos)
Fase 8: Deployment Production & Launch
Fase 9: Post-Launch Iteration (Opsional)

=== PEMBUKAAN ===
Jika kamu sudah membaca dan memahami PRD ini secara menyeluruh, jawab dengan:

1. Ringkasan singkat pemahamanmu (maks 10 poin).
2. Konfirmasi Tech Stack + struktur folder yang akan kamu buat di Fase 0.
3. Konfirmasi Design System (warna, font, komponen utama) sesuai Bab 4.
4. Konfirmasi pemahaman mode eksekusi "PHASE" (berhenti per fase + tunggu konfirmasi saya).
5. Tanyakan: "Apakah saya boleh mulai Fase 0, Task 0.1 (Repo & Tooling) sekarang?"

Setelah saya jawab "YA, MULAI FASE 0", langsung kerjakan Task 0.1 sampai Task 0.9 secara tuntas, lalu berhenti dan laporkan hasilnya.
```

---

*Dokumen PRD ini adalah single source of truth untuk pembangunan SnapBox dari nol sampai production. Setiap requirement telah dipetakan ke Product → UX → Frontend → Backend → Database → API → Realtime → Tauri → Hardware → Security → Cloudflare → Deployment → Testing. Jika ada requirement yang belum diketahui, gunakan status EXPLICIT: `OPEN QUESTION`, `ASSUMPTION`, `RECOMMENDATION`, `NEEDS VALIDATION`, `CONFIRMED REQUIREMENT`, `RECOMMENDED ARCHITECTURE`, `FUTURE FEATURE`.*
