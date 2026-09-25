-- Task 1.8: activity_logs bersifat immutable (PRD Bab 8.8, Bab 8.10).
--
-- Sebelum migrasi ini, kekekalan `activity_logs` hanya konvensi di helper
-- aplikasi. Itu tidak cukup untuk audit trail: kesalahan query, kode baru, atau
-- akses langsung ke DB tetap bisa mengubah atau menghapus baris. Trigger di
-- bawah menutup jalur itu di level database, sementara RLS dan grant yang sudah
-- ada tetap mengatur siapa yang boleh INSERT.

-- Fungsi trigger menolak UPDATE dan DELETE. `SECURITY INVOKER` (default) supaya
-- pemanggil tidak mendapat hak tambahan lewat fungsi ini.
CREATE OR REPLACE FUNCTION app.reject_activity_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs bersifat immutable: % tidak diizinkan', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Idempotent: aman dijalankan ulang pada environment yang sudah punya trigger.
DROP TRIGGER IF EXISTS snapbox_activity_logs_immutable ON public.activity_logs;

CREATE TRIGGER snapbox_activity_logs_immutable
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION app.reject_activity_log_mutation();

-- Cabut UPDATE/DELETE dari role aplikasi bila role tersebut ada. INSERT dan
-- SELECT tetap; aplikasi hanya perlu menulis dan membaca audit, tidak pernah
-- mengubah atau menghapusnya.
--
-- SENGAJA tidak ada jalur DELETE untuk `authenticated`: retensi 5 tahun (PRD Bab
-- 8.10) dijalankan sebagai fungsi/service role terjadwal yang di-grant khusus,
-- BUKAN lewat role aplikasi. Jangan menambahkan kembali `DELETE ... TO
-- authenticated` untuk "memperbaiki" migrasi ini; buat grant terpisah untuk role
-- pembersih bila purge diimplementasikan.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON public.activity_logs FROM authenticated;
  END IF;
END
$$;
