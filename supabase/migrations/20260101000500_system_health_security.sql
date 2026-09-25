-- ============================================================================
-- 20260101000500_system_health_security.sql
-- Task 1.11 (PRD Task 1.11, Bab 8.9) - telemetry kesehatan sistem + keamanan.
--
-- Tiga tabel operasional, BUKAN pengganti audit:
--   security_events      : sinyal login gagal / rate limit / WAF
--   auth_sessions        : catatan sesi login web (bukan cookie/token)
--   system_health_checks : heartbeat per komponen + job cron
--
-- SUMBER DDL TUNGGAL. `packages/db/src/schema.ts` mencerminkan bentuk yang sama,
-- dan tidak boleh ada migration Drizzle yang membuat tabel ini lagi: dua DDL
-- divergen dengan `IF NOT EXISTS` akan membuat yang dijalankan kedua menjadi
-- no-op senyap, sehingga kolom DB bisa tidak cocok dengan query runtime.
--
-- Aturan privasi (PRD Bab 8.9): DILARANG menyimpan password, token, signature
-- mentah, payload request, atau IP mentah. IP disimpan sebagai hash satu arah
-- (ip_hash/source_fingerprint); subjek disimpan ter-hash oleh service layer.
--
-- Idempotent: seluruh DDL memakai `if not exists` / `drop policy if exists`
-- sehingga aman dijalankan ulang.
-- ============================================================================

-- ============================================================================
-- security_events
-- ============================================================================
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type varchar(40) not null,
  severity varchar(20) not null default 'INFO',
  source varchar(80) not null,
  route varchar(160),
  subject_fingerprint varchar(128),
  source_fingerprint varchar(128),
  detail jsonb,
  request_id varchar(80),
  provider_event_id varchar(200),
  created_at timestamptz not null default now(),
  constraint security_events_severity_chk check (severity in ('INFO', 'WARNING', 'CRITICAL'))
);

-- Idempotensi event eksternal (mis. Cloudflare WAF). Partial: NULL berulang
-- diizinkan sehingga event internal tanpa id penyedia tetap bisa ditulis.
-- Konflik memakai pasangan (source, provider_event_id), SEJALAN dengan
-- `onConflictDoNothing()` di `recordWafEvent`.
create unique index if not exists security_events_provider_event_idx
  on public.security_events(source, provider_event_id)
  where provider_event_id is not null;

create index if not exists security_events_type_created_idx
  on public.security_events(event_type, created_at);

create index if not exists security_events_created_idx
  on public.security_events(created_at);

comment on table public.security_events is
  'Task 1.11: telemetry sinyal keamanan (login gagal, rate limit, WAF). Bukan pengganti activity_logs; dilarang memuat password/token/signature/IP mentah.';
comment on column public.security_events.subject_fingerprint is
  'Hash satu arah dari subjek (mis. email); nilai mentah dilarang.';
comment on column public.security_events.source_fingerprint is
  'Hash satu arah dari sumber (mis. IP klien); nilai mentah dilarang.';

-- ============================================================================
-- auth_sessions
-- ============================================================================
create table if not exists public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_hash varchar(128),
  user_agent varchar(200)
);

create index if not exists auth_sessions_active_idx
  on public.auth_sessions(user_id, revoked_at, expires_at);

create index if not exists auth_sessions_expires_idx
  on public.auth_sessions(expires_at);

comment on table public.auth_sessions is
  'Task 1.11: catatan sesi login web untuk panel sesi aktif. Cookie/token mentah dilarang; IP disimpan sebagai hash satu arah.';
comment on column public.auth_sessions.ip_hash is
  'Hash satu arah (SHA-256 + salt server) dari IP klien; bukan IP mentah.';

-- ============================================================================
-- system_health_checks
-- ============================================================================
create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  check_key varchar(60) not null unique,
  component varchar(80) not null,
  status varchar(20) not null,
  latency_ms integer,
  observed_at timestamptz not null default now(),
  last_success_at timestamptz,
  detail jsonb,
  constraint system_health_status_chk check (status in ('healthy', 'degraded', 'outage', 'unavailable'))
);

create index if not exists health_observed_idx
  on public.system_health_checks(observed_at);

create index if not exists health_component_idx
  on public.system_health_checks(component);

comment on table public.system_health_checks is
  'Task 1.11: heartbeat terakhir per komponen (Supabase, Firebase, Cloudflare, gateway, antrean webhook, cron, Sentry). Satu baris per check_key.';
comment on column public.system_health_checks.detail is
  'Ringkasan aman; dilarang memuat secret, token, atau stack trace mentah.';

-- ============================================================================
-- RLS lapisan kedua (ADR-004). Otorisasi service layer tetap wajib; RLS hanya
-- menutup jalur non-owner (PostgREST/Realtime).
-- ============================================================================
--
-- Ketiga tabel adalah telemetry platform-internal: TIDAK ada baris milik tenant
-- (auth_sessions pun tidak menyimpan tenant_id). Karena itu policy HANYA SELECT
-- untuk CEO, dan SENGAJA tidak ada policy INSERT/UPDATE/DELETE untuk
-- `authenticated`: jalur tulis adalah service layer/route handler sebagai owner
-- dan endpoint ingest terverifikasi secret.
--
-- `app.is_ceo()` mengembalikan false (bukan NULL) saat tidak ada klaim, sehingga
-- policy fail-closed terhadap anon.
alter table public.security_events enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.system_health_checks enable row level security;

drop policy if exists security_events_ceo on public.security_events;
drop policy if exists auth_sessions_ceo on public.auth_sessions;
drop policy if exists system_health_ceo on public.system_health_checks;

create policy security_events_ceo_read on public.security_events
  for select to authenticated
  using (app.is_ceo());

create policy auth_sessions_ceo_read on public.auth_sessions
  for select to authenticated
  using (app.is_ceo());

create policy system_health_ceo_read on public.system_health_checks
  for select to authenticated
  using (app.is_ceo());

-- ============================================================================
-- Retensi (dokumentasi, bukan job). security_events dan system_health_checks
-- adalah telemetry operasional, bukan audit; retensi panjang dijalankan job
-- terjadwal terpisah, BUKAN lewat role aplikasi.
-- ============================================================================
