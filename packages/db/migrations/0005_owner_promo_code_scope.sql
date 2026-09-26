-- Owner voucher codes are unique within tenant; global CEO codes keep a separate namespace.
DROP INDEX IF EXISTS public.promos_code_lower_idx;

CREATE UNIQUE INDEX IF NOT EXISTS promos_tenant_code_lower_idx
  ON public.promos (tenant_id, lower(code))
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS promos_global_code_lower_idx
  ON public.promos (lower(code))
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS promo_redemptions_tenant_customer_idx
  ON public.promo_redemptions (tenant_id, promo_id, customer_email);
