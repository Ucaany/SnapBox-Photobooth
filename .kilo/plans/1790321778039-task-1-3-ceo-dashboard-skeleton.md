# Task 1.3 Super Admin Dashboard Skeleton

## Keputusan

- Scope hanya skeleton UI dan navigasi untuk CEO. Tidak membuat CRUD, server actions, query DB, broadcast realtime, atau mutasi keamanan.
- Struktur mengikuti PRD: `/ceo-dashboard` sebagai dashboard utama, lalu `tenants`, `subscriptions`, `plans`, `devices`, `broadcast`, `activity-log`, `promos`, `settings`, `system-health`, dan `security`.
- Visual mengikuti ADR-002 dan token aktif `@snapbox/ui`, bukan mengoverride palet dengan warna PRD yang belum menjadi token kanonik. Gunakan Space Grotesk, Inter, JetBrains Mono, border/shadow neobrutalism, serta density dashboard.
- Semua angka, tenant, device, event, dan status bersifat data contoh. Tampilkan label `Data contoh` pada area data, jangan membuatnya tampak sebagai telemetry/claim produksi.
- Dials desain: ENERGY 2 / RHYTHM 2 / MOTION 1. Fokus layar adalah judul route dan satu panel kerja utama; variasi komposisi mengikuti kebutuhan tiap modul, motion hanya hover/focus/transisi sidebar.
- Tidak menambah dependency ikon. Pakai ikon yang sudah diekspor `@snapbox/ui`/inline glyph seperlunya, dengan label teks selalu hadir.

## Implementasi

1. Buat route group `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/` dengan `layout.tsx` dan `page.tsx`. Layout server menetapkan metadata `noindex`, merender `CeoDashboardShell`, dan tidak memindahkan otorisasi dari middleware/server boundary yang sudah ada.
2. Buat `apps/web/src/components/ceo-dashboard/ceo-dashboard-shell.tsx` sebagai client shell memakai `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarMenu`, `SidebarMenuButton`, `SidebarInset`, dan `SidebarTrigger` dari `@snapbox/ui`. Sidebar desktop dapat collapse; mobile memakai drawer bawaan primitive. Pastikan `aria-label`, active state berbasis pathname, tooltip hanya pelengkap, dan semua item menuju route nyata.
3. Buat `apps/web/src/components/ceo-dashboard/ceo-dashboard-header.tsx`: breadcrumb/judul route, tombol sidebar, `ThemeToggle`, serta menu akun/logout yang mengarah ke endpoint/logout flow yang sudah tersedia atau gunakan link `/login` hanya setelah logout action benar-benar di-wire. Jangan menambah tombol mati.
4. Buat registry navigasi/content tunggal, misalnya `apps/web/src/components/ceo-dashboard/ceo-dashboard-content.tsx`, berisi slug, label, deskripsi, group sidebar, metadata halaman, dan tipe panel. Registry menjadi sumber active nav dan judul header agar 11 route tidak drift.
5. Implementasikan page renderer bersama untuk panel dummy. Setiap view memiliki heading, deskripsi kontekstual, label `Data contoh`, state empty/loading/error yang dapat dipicu secara lokal bila view menampilkan data, serta konten yang sesuai PRD:
   - Dashboard: metric tiles bertanda data contoh, growth/event panel, system alert panel.
   - Tenants: tabel contoh dengan search/filter controls yang bekerja pada dataset lokal, status/plan badges, empty result state.
   - Subscriptions: invoice list contoh, status filter, retry control yang memberi feedback lokal dan tidak mengklaim memanggil gateway.
   - Plans: perbandingan Starter/Growth/Enterprise sebagai data contoh read-only, feature/limit rows, disabled editor affordance tidak boleh dibuat sebagai tombol mati.
   - Devices: monitor device contoh, status/version/OS/heartbeat rows, filter status, empty state.
   - Broadcast: form audience/message contoh dengan validasi, submit menampilkan feedback lokal; jelaskan bahwa pengiriman realtime belum aktif.
   - Activity log: immutable-looking audit rows contoh dengan actor/action/resource/date filter UI, tanpa menyatakan data produksi.
   - Promos: promo rows contoh, active/inactive filter, quota/status display, no create/delete mutation.
   - Settings: grouped global setting fields rendered as explicitly non-persistent example controls, with a clear `Data contoh` notice and no fake save action.
   - System health: service status rows contoh, queue/cron panels, loading and failure simulation/state copy.
   - Security: failed-login/rate-limit/WAF/session panels contoh, filters and explanatory empty state, no fabricated security/compliance claim.
6. Buat route files untuk seluruh slug (`tenants/page.tsx`, `subscriptions/page.tsx`, dan seterusnya) yang memanggil renderer/konfigurasi bersama. Hindari 11 salinan layout; setiap route tetap memiliki konten berbeda melalui registry.
7. Tambahkan CSS scoped `ceo-*` ke `apps/web/src/app/globals.css` di luar blok token-sync. Gunakan layout grid/sidebar inset, surface warm/secondary token, border tebal dan hard shadow selektif, responsive collapse, overflow-x clip, 44px tap targets, visible focus ring, tabel yang dapat scroll horizontal hanya di wrapper tabel, serta reduced-motion fallback.
8. Jika primitive Sidebar memerlukan `bg-sidebar`, selaraskan token `--color-sidebar` pada blok token di `packages/ui/src/styles.css` dan `apps/web/src/app/globals.css` sekaligus, lalu jalankan guard token-sync. Jangan hanya menambahkan variable pada satu konsumen.
9. Update `apps/web/src/lib/auth/route-policy.ts` hanya bila route prefix/mapping saat ini tidak mencakup subroute CEO. Pertahankan rule CEO-only; jangan mengendurkan middleware. Tambahkan komentar bahwa skeleton route tetap dilindungi.

## Interaksi dan states

- Sidebar collapse, mobile drawer, active link, theme toggle, search/filter, tabs/select, form validation, dan feedback submit harus benar-benar bekerja.
- Tidak ada link `#`, tombol placeholder, atau kontrol editor palsu. Fitur yang belum ada ditampilkan sebagai teks status `Belum tersambung`/`Data contoh`, bukan affordance interaktif.
- Dataset lokal kecil cukup untuk skeleton. Jangan membuat angka produksi, nama pelanggan nyata, token, API key, atau klaim uptime/compliance.
- Keyboard: urutan tab logis, `Escape` menutup drawer/dialog primitive, focus-visible konsisten, label form terhubung.

## Validasi

1. Jalankan `pnpm --filter @snapbox/web lint`, `pnpm --filter @snapbox/web typecheck`, dan `pnpm --filter @snapbox/web build`.
2. Jalankan guard token-sync bila token Sidebar berubah.
3. Verifikasi middleware matrix: anonymous diarahkan `/login`, role non-CEO ditolak, CEO dapat membuka root dan seluruh 10 subroute, unknown subroute tetap 404.
4. Browser click-through seluruh sidebar item, breadcrumb/back path bila ada, sidebar collapse/mobile drawer, theme toggle, filter/search, broadcast validation/feedback, serta setiap submit/control; catat tidak ada console error.
5. Uji viewport desktop, tablet, dan mobile: tidak ada horizontal overflow di shell, tabel hanya overflow di wrapper yang disengaja, sidebar drawer dapat dibuka/ditutup, target sentuh minimal 44px.
6. Audit content: semua dummy numbers/entities/status memiliki label `Data contoh`; tidak ada em dash, dead control, fabricated claim, atau route link tanpa destination.

## Di luar scope

- Tenant provisioning/detail/wizard (Task 1.4), plan editor persistence (Task 1.5), subscription engine/webhook (Task 1.6), realtime broadcast, audit persistence, settings secrets, health probes, security event ingestion.
- Perubahan database, migration, API, Firebase session contract, dan dashboard Owner/Staff.
