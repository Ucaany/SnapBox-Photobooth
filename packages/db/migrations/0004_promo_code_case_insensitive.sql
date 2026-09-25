-- Task 1.10: kode promo wajib unik tanpa memandang huruf besar/kecil (PRD Bab 6.F).
--
-- Sebelum migrasi ini `promos_code_idx` adalah unique index pada `code` apa
-- adanya, sehingga `PROMO2026` dan `promo2026` bisa hidup berdampingan dan
-- divalidasi sebagai dua voucher berbeda padahal kiosk membacanya sebagai satu
-- kode. Aplikasi sudah menormalkan kode ke uppercase, tetapi jaminan sebenarnya
-- harus ada di database: expression index `lower(code)`.
--
-- Aman dijalankan ulang (idempotent) dan GAGAL dengan pesan jelas bila data
-- existing sudah punya duplikat case-insensitive, sehingga konflik ditemukan
-- operator sebelum index dibuat, bukan setelah.

-- 1. Deteksi duplikat lama sebelum memasang invariant baru.
DO $$
DECLARE
  conflict_count integer;
  conflict_samples text;
BEGIN
  SELECT count(*), string_agg(DISTINCT lower(code), ', ')
    INTO conflict_count, conflict_samples
  FROM public.promos
  GROUP BY lower(code)
  HAVING count(*) > 1
  ORDER BY count(*) DESC
  LIMIT 1;

  IF conflict_count IS NOT NULL THEN
    RAISE EXCEPTION
      'promos punya % kode duplikat case-insensitive (contoh: %). Rapikan data sebelum menjalankan migrasi Task 1.10.',
      conflict_count, conflict_samples
      USING ERRCODE = 'unique_violation';
  END IF;
END
$$;

-- 2. Ganti unique index kolom dengan expression index `lower(code)`.
DROP INDEX IF EXISTS public.promos_code_idx;

CREATE UNIQUE INDEX IF NOT EXISTS promos_code_lower_idx
  ON public.promos USING btree (lower(code));

COMMENT ON INDEX public.promos_code_lower_idx IS
  'Task 1.10: kode voucher case-insensitive; satu kode kanonik per platform dan tenant.';
