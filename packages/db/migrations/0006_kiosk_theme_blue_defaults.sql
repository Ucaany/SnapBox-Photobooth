-- D-01 (AUDIT/11, 2026-09-26): default palet kiosk menjadi biru.
--
-- `kiosk_themes.primary_color/accent_color/background_color` masih membawa
-- default palet PRD (kuning/violet/warm-white) dari baseline 0000. Itu bukan
-- sisa yang tidak terpakai: `apps/web/src/lib/owner-dashboard/kiosk-theme-server.ts`
-- menyisipkan baris baru TANPA mengirim warna (`values({ tenantId, boothId: null })`),
-- jadi kolom DEFAULT inilah yang benar-benar dirender oleh kiosk untuk setiap
-- tema yang baru dibuat. Tanpa migrasi ini, seluruh deployment yang sudah ada
-- tetap menyajikan tema kiosk kuning/violet meskipun `BRAND.palette` dan
-- `kiosk-theme-contract.ts` sudah biru.
--
-- Hanya DEFAULT yang diubah. Baris `kiosk_themes` yang SUDAH ada tetap
-- menyimpan warnanya: itu keputusan data (backfill) yang terpisah dari
-- keputusan palet, dan tidak boleh ditebak di sini.
--
-- Idempotent: `SET DEFAULT` aman dijalankan ulang.

ALTER TABLE public.kiosk_themes ALTER COLUMN primary_color SET DEFAULT '#5294FF';
ALTER TABLE public.kiosk_themes ALTER COLUMN accent_color SET DEFAULT '#1D4ED8';
ALTER TABLE public.kiosk_themes ALTER COLUMN background_color SET DEFAULT '#DCEBFE';

COMMENT ON COLUMN public.kiosk_themes.primary_color IS
  'Default palet biru (D-01, 2026-09-26). Owner boleh override; kontras minimum 4.5:1 divalidasi di aplikasi.';
