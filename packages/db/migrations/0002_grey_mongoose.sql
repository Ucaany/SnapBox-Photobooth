CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(120) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_settings_key_idx" ON "platform_settings" USING btree ("key");
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_settings TO authenticated;

-- Task 1.9: pengaturan global platform bersifat platform-only, sama seperti tabel
-- `plans` dan `broadcasts` (Task 0.8). RLS diaktifkan lewat helper `app.enforce_rls`
-- supaya konsisten dengan `packages/db/migrations/0001_rls_and_realtime.sql`.
SELECT app.enforce_rls('public.platform_settings');

DROP POLICY IF EXISTS snapbox_platform_settings_ceo ON public.platform_settings;
CREATE POLICY snapbox_platform_settings_ceo ON public.platform_settings
  FOR ALL TO authenticated
  USING (app.is_ceo())
  WITH CHECK (app.is_ceo());--> statement-breakpoint

-- Nilai default aman (bukan secret) untuk template email dan feature flag.
-- Nomor WhatsApp dan email balasan default SENGAJA tidak diisi: keduanya nilai
-- operasional yang harus dipilih operator, bukan ditebak dari placeholder.
-- `ON CONFLICT DO NOTHING` membuat migrasi idempotent bila dijalankan ulang pada
-- environment yang sudah punya baris.
INSERT INTO "platform_settings" ("key", "value") VALUES
  ('email_template.tenant_invite', '{"subject":"Undangan bergabung ke SnapBox","body":"Halo {{ownerName}},\n\nAkun SnapBox untuk {{companyName}} sudah disiapkan. Aktifkan dengan mengatur kata sandi lewat tautan berikut (berlaku {{expiresIn}}):\n\n{{actionUrl}}\n\nSalam,\nTim SnapBox"}'::jsonb),
  ('email_template.invoice_b2b', '{"subject":"Invoice langganan SnapBox {{invoiceId}}","body":"Halo {{ownerName}},\n\nInvoice untuk {{companyName}} dengan nominal {{amount}} telah diterbitkan. Bayar sebelum {{dueDate}} lewat tautan berikut:\n\n{{paymentUrl}}\n\nSalam,\nTim SnapBox"}'::jsonb),
  ('email_template.subscription_expiring', '{"subject":"Langganan SnapBox {{companyName}} segera berakhir","body":"Halo {{ownerName}},\n\nLangganan {{companyName}} berakhir pada {{expiresAt}}. Perpanjang agar booth tetap aktif.\n\n{{actionUrl}}\n\nSalam,\nTim SnapBox"}'::jsonb),
  ('feature_flag.kiosk_theme_customizer', 'false'::jsonb),
  ('feature_flag.advanced_promo_batch', 'false'::jsonb),
  ('feature_flag.web_device_console', 'true'::jsonb)
ON CONFLICT ("key") DO NOTHING;
