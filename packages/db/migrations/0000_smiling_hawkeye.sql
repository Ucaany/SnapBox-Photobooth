CREATE TYPE "public"."booth_status" AS ENUM('ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNPAIRED', 'DEGRADED');--> statement-breakpoint
CREATE TYPE "public"."camera_status" AS ENUM('SUPPORTED', 'LIMITED', 'EXPERIMENTAL', 'NOT_SUPPORTED', 'DEPRECATED');--> statement-breakpoint
CREATE TYPE "public"."gateway_mode" AS ENUM('SANDBOX', 'PRODUCTION');--> statement-breakpoint
CREATE TYPE "public"."gateway_provider" AS ENUM('MIDTRANS', 'XENDIT', 'DOKU', 'PAKASIR');--> statement-breakpoint
CREATE TYPE "public"."kiosk_panel_style" AS ENUM('CLASSIC', 'CARD', 'RECEIPT');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('LOW_PAPER', 'BOOTH_OFFLINE', 'SUBSCRIPTION_EXPIRING', 'PAYMENT_PAID', 'PRINTER_ERROR', 'DEVICE_PAIRED', 'DEVICE_REVOKED', 'BROADCAST', 'GENERAL', 'CAMERA_ERROR');--> statement-breakpoint
CREATE TYPE "public"."orientation" AS ENUM('LANDSCAPE', 'PORTRAIT');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'QRIS_MIDTRANS', 'QRIS_XENDIT', 'QRIS_DOKU', 'QRIS_PAKASIR', 'VOUCHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('STARTER', 'GROWTH', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('PENDING', 'ACTIVE', 'EXPIRING', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CEO', 'OWNER', 'STAFF');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" varchar(255),
	"actor_role" "user_role",
	"tenant_id" uuid,
	"booth_id" uuid,
	"device_id" uuid,
	"action" varchar(80) NOT NULL,
	"resource_type" varchar(60),
	"resource_id" varchar(80),
	"reason" text,
	"metadata" jsonb,
	"ip_address" varchar(60),
	"user_agent" text,
	"request_id" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "b2b_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"plan_tier" "plan_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'PENDING' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"grace_period_until" timestamp with time zone,
	"pakasir_invoice_id" varchar(128),
	"pakasir_payment_url" text,
	"pakasir_transaction_id" varchar(128),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "b2b_subscriptions_pakasir_invoice_id_unique" UNIQUE("pakasir_invoice_id"),
	CONSTRAINT "b2b_subscriptions_pakasir_transaction_id_unique" UNIQUE("pakasir_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "b2c_payment_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "gateway_provider" NOT NULL,
	"mode" "gateway_mode" DEFAULT 'SANDBOX' NOT NULL,
	"api_key_encrypted" "bytea",
	"secret_key_encrypted" "bytea",
	"merchant_id" varchar(120),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_tested_at" timestamp with time zone,
	"last_test_success" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booth_frames" (
	"booth_id" uuid NOT NULL,
	"frame_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booth_frames_booth_id_frame_id_pk" PRIMARY KEY("booth_id","frame_id")
);
--> statement-breakpoint
CREATE TABLE "booths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid,
	"name" varchar(150) NOT NULL,
	"location_tag" varchar(150),
	"status" "booth_status" DEFAULT 'UNPAIRED' NOT NULL,
	"pairing_code" varchar(12),
	"pairing_code_hash" varchar(128),
	"pairing_code_expires_at" timestamp with time zone,
	"device_fingerprint" varchar(128),
	"paper_count" integer DEFAULT 0 NOT NULL,
	"paper_capacity" integer DEFAULT 200 NOT NULL,
	"paper_alert_threshold_pct" integer DEFAULT 20 NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"pin_lock_enabled" boolean DEFAULT false NOT NULL,
	"pin_lock_pin_hash" varchar(128),
	"operator_pin_hash" varchar(128),
	"last_heartbeat_at" timestamp with time zone,
	"camera_id" varchar(120),
	"camera_type" varchar(40),
	"printer_name" varchar(200),
	"printer_paper_size" varchar(40) DEFAULT '4x6',
	"printer_port" varchar(60),
	"printer_vendor" varchar(60),
	"printer_model" varchar(120),
	"display_orientation" "orientation" DEFAULT 'LANDSCAPE' NOT NULL,
	"app_version" varchar(40),
	"platform" varchar(40),
	"config_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booths_device_fingerprint_unique" UNIQUE("device_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"target_tenant_ids" jsonb,
	"target_all" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camera_compatibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" varchar(40) NOT NULL,
	"model" varchar(120) NOT NULL,
	"family" varchar(80),
	"sdk" varchar(80),
	"sdk_version" varchar(40),
	"connection" varchar(40),
	"remote_capture" boolean DEFAULT false NOT NULL,
	"live_view" boolean DEFAULT false NOT NULL,
	"recommended" boolean DEFAULT false NOT NULL,
	"minimum_firmware" varchar(40),
	"notes" text,
	"known_issues" text,
	"status" "camera_status" DEFAULT 'EXPERIMENTAL' NOT NULL,
	"supported_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"name" varchar(150),
	"total_photos" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_visit_at" timestamp with time zone,
	"consent_showcase" boolean DEFAULT false NOT NULL,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_fingerprint" varchar(128) NOT NULL,
	"camera_id" varchar(120) NOT NULL,
	"mirror_x" boolean DEFAULT false NOT NULL,
	"mirror_y" boolean DEFAULT false NOT NULL,
	"rotation_deg" integer DEFAULT 0 NOT NULL,
	"zoom_level" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"offset_x" integer DEFAULT 0 NOT NULL,
	"offset_y" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid,
	"booth_id" uuid,
	"tenant_id" uuid,
	"level" varchar(20) NOT NULL,
	"service" varchar(60),
	"event" varchar(120),
	"error_code" varchar(80),
	"message" text,
	"metadata" jsonb,
	"session_id" uuid,
	"request_id" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booth_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_fingerprint" varchar(128) NOT NULL,
	"app_version" varchar(40),
	"platform" varchar(40),
	"os_version" varchar(120),
	"last_heartbeat_at" timestamp with time zone,
	"uptime_seconds" integer,
	"session_jwt_hash" varchar(128),
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_fingerprint_unique" UNIQUE("device_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "download_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"transaction_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"ip_address" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "download_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "frame_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frame_id" uuid NOT NULL,
	"storage_url" text NOT NULL,
	"transparent_color_hex" varchar(9),
	"tolerance_delta" integer DEFAULT 15 NOT NULL,
	"version_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"storage_url" text NOT NULL,
	"thumbnail_url" text,
	"layer" varchar(20) DEFAULT 'FRONT' NOT NULL,
	"transparent_color_hex" varchar(9),
	"tolerance_delta" integer DEFAULT 15 NOT NULL,
	"width" integer,
	"height" integer,
	"file_size_bytes" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosk_theme_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosk_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"booth_id" uuid,
	"logo_url" text,
	"primary_color" varchar(9) DEFAULT '#FFDD00' NOT NULL,
	"accent_color" varchar(9) DEFAULT '#8B5CF6' NOT NULL,
	"background_color" varchar(9) DEFAULT '#FFFEF5' NOT NULL,
	"font_family" varchar(80) DEFAULT 'Space Grotesk' NOT NULL,
	"welcome_text" text,
	"cta_text" varchar(120) DEFAULT 'SENTUH UNTUK MULAI ✨',
	"attract_mode_type" varchar(20) DEFAULT 'VIDEO' NOT NULL,
	"attract_video_url" text,
	"attract_slideshow_enabled" boolean DEFAULT true NOT NULL,
	"panel_style" "kiosk_panel_style" DEFAULT 'CLASSIC' NOT NULL,
	"orientation" "orientation" DEFAULT 'LANDSCAPE' NOT NULL,
	"pre_payment_guide" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"tenant_id" uuid,
	"booth_id" uuid,
	"type" "notification_type" NOT NULL,
	"severity" varchar(20) DEFAULT 'INFO' NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"pic_name" varchar(150),
	"pic_phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"booth_id" uuid,
	"name" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"pose_count" integer DEFAULT 1 NOT NULL,
	"print_count" integer DEFAULT 1 NOT NULL,
	"retake_limit" integer DEFAULT -1 NOT NULL,
	"include_gif" boolean DEFAULT true NOT NULL,
	"print_size" varchar(20) DEFAULT '4x6' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairing_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"booth_id" uuid NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"manual_code" varchar(12),
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booth_id" uuid NOT NULL,
	"old_count" integer NOT NULL,
	"new_count" integer NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(60) NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "plan_tier" NOT NULL,
	"name" varchar(100) NOT NULL,
	"price_monthly" numeric(12, 2) NOT NULL,
	"price_yearly" numeric(12, 2),
	"features" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transaction_id" uuid,
	"customer_email" varchar(255),
	"discount_applied" numeric(12, 2) NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"is_global" boolean DEFAULT false NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(150),
	"type" "promo_type" NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"min_purchase" numeric(12, 2) DEFAULT '0' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"quota_total" integer,
	"quota_used" integer DEFAULT 0 NOT NULL,
	"quota_per_customer" integer DEFAULT 1 NOT NULL,
	"booth_scope" jsonb,
	"package_scope" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"booth_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid,
	"state" varchar(40) NOT NULL,
	"actor" varchar(40),
	"enter_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exit_at" timestamp with time zone,
	"duration_ms" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_code" varchar(80),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"layout_type" varchar(40) NOT NULL,
	"pose_grid" jsonb,
	"print_dimensions" varchar(40),
	"aspect_ratio" varchar(20),
	"background" varchar(20),
	"preview_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(200) NOT NULL,
	"owner_email" varchar(255) NOT NULL,
	"owner_phone" varchar(20),
	"address" text,
	"logo_url" text,
	"plan_tier" "plan_tier" DEFAULT 'STARTER' NOT NULL,
	"status" "tenant_status" DEFAULT 'ACTIVE' NOT NULL,
	"device_quota" integer DEFAULT 1 NOT NULL,
	"add_on_devices" integer DEFAULT 0 NOT NULL,
	"frame_quota" integer DEFAULT 3 NOT NULL,
	"storage_quota_mb" integer DEFAULT 2048 NOT NULL,
	"staff_quota" integer DEFAULT 2 NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trx_code" varchar(40) NOT NULL,
	"booth_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid,
	"package_id" uuid,
	"package_name" varchar(100),
	"amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"final_amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"gateway_provider" "gateway_provider",
	"gateway_transaction_id" varchar(200),
	"gateway_payment_url" text,
	"gateway_qr_string" text,
	"gateway_expires_at" timestamp with time zone,
	"voucher_code" varchar(20),
	"customer_email" varchar(255),
	"customer_consent_showcase" boolean DEFAULT false NOT NULL,
	"filter_applied" varchar(60),
	"pose_count" integer DEFAULT 1 NOT NULL,
	"retake_used" integer DEFAULT 0 NOT NULL,
	"raw_photo_url" text,
	"framed_photo_url" text,
	"gif_url" text,
	"soft_copy_token" varchar(64),
	"soft_copy_token_expires_at" timestamp with time zone,
	"soft_copy_token_used" boolean DEFAULT false NOT NULL,
	"printed" boolean DEFAULT false NOT NULL,
	"printer_error" text,
	"paid_at" timestamp with time zone,
	"captured_at" timestamp with time zone,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_trx_code_unique" UNIQUE("trx_code"),
	CONSTRAINT "transactions_gateway_transaction_id_unique" UNIQUE("gateway_transaction_id"),
	CONSTRAINT "transactions_soft_copy_token_unique" UNIQUE("soft_copy_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"phone" varchar(20),
	"role" "user_role" NOT NULL,
	"tenant_id" uuid,
	"parent_tenant_id" uuid,
	"disabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_event_id" varchar(200) NOT NULL,
	"event_type" varchar(80),
	"payload" jsonb NOT NULL,
	"signature_valid" boolean NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"retried_count" integer DEFAULT 0 NOT NULL,
	"last_retried_at" timestamp with time zone,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_subscriptions" ADD CONSTRAINT "b2b_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_subscriptions" ADD CONSTRAINT "b2b_subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2c_payment_configs" ADD CONSTRAINT "b2c_payment_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_frames" ADD CONSTRAINT "booth_frames_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booth_frames" ADD CONSTRAINT "booth_frames_frame_id_frames_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booths" ADD CONSTRAINT "booths_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booths" ADD CONSTRAINT "booths_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_tokens" ADD CONSTRAINT "download_tokens_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frame_versions" ADD CONSTRAINT "frame_versions_frame_id_frames_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_theme_versions" ADD CONSTRAINT "kiosk_theme_versions_theme_id_kiosk_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."kiosk_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_themes" ADD CONSTRAINT "kiosk_themes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiosk_themes" ADD CONSTRAINT "kiosk_themes_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_tokens" ADD CONSTRAINT "pairing_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_tokens" ADD CONSTRAINT "pairing_tokens_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_logs" ADD CONSTRAINT "paper_logs_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_id_promos_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promos" ADD CONSTRAINT "promos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booth_id_booths_id_fk" FOREIGN KEY ("booth_id") REFERENCES "public"."booths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_actor_idx" ON "activity_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "log_tenant_idx" ON "activity_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "log_action_idx" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "log_created_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "b2b_subs_tenant_idx" ON "b2b_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "b2b_subs_status_idx" ON "b2b_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "b2b_subs_expiry_idx" ON "b2b_subscriptions" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "b2c_provider_tenant_idx" ON "b2c_payment_configs" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX "booths_tenant_idx" ON "booths" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "booths_status_idx" ON "booths" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booths_outlet_idx" ON "booths" USING btree ("outlet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booths_fp_idx" ON "booths" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "cam_brand_model_idx" ON "camera_compatibility" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "cam_status_idx" ON "camera_compatibility" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_tenant_email_idx" ON "customers" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "calib_fp_cam_idx" ON "device_calibrations" USING btree ("device_fingerprint","camera_id");--> statement-breakpoint
CREATE INDEX "devlog_device_idx" ON "device_logs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "devlog_booth_idx" ON "device_logs" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "devlog_created_idx" ON "device_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "devices_booth_idx" ON "devices" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "devices_tenant_idx" ON "devices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "frames_tenant_idx" ON "frames" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "frames_active_idx" ON "frames" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_tenant_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notif_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "outlets_tenant_idx" ON "outlets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_code_idx" ON "pairing_tokens" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "pair_booth_idx" ON "pairing_tokens" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "paper_booth_idx" ON "paper_logs" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "redemption_promo_idx" ON "promo_redemptions" USING btree ("promo_id");--> statement-breakpoint
CREATE INDEX "redemption_customer_idx" ON "promo_redemptions" USING btree ("customer_email");--> statement-breakpoint
CREATE UNIQUE INDEX "promos_code_idx" ON "promos" USING btree ("code");--> statement-breakpoint
CREATE INDEX "promos_tenant_idx" ON "promos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "session_trx_idx" ON "sessions" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "session_booth_idx" ON "sessions" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "session_state_idx" ON "sessions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_plan_idx" ON "tenants" USING btree ("plan_tier");--> statement-breakpoint
CREATE INDEX "trx_booth_idx" ON "transactions" USING btree ("booth_id");--> statement-breakpoint
CREATE INDEX "trx_tenant_idx" ON "transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "trx_status_idx" ON "transactions" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "trx_created_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trx_token_idx" ON "transactions" USING btree ("soft_copy_token");--> statement-breakpoint
CREATE UNIQUE INDEX "trx_gateway_idx" ON "transactions" USING btree ("gateway_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wh_event_uniq_idx" ON "webhook_events" USING btree ("provider","provider_event_id");