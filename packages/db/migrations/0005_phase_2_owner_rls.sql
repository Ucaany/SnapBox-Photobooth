-- Task 2.19: complete Owner-phase RLS without rewriting the applied schema baseline.
-- The 24 Owner tables, constraints, and indexes are created by 0000; this
-- additive migration closes parent/tenant mismatches and exposes the public
-- camera registry as read-only.

-- Tenant-owned rows with foreign keys must agree with the tenant of every
-- referenced tenant-owned parent, not merely with the caller's tenant claim.
DROP POLICY IF EXISTS snapbox_devices_tenant ON public.devices;
CREATE POLICY snapbox_devices_tenant ON public.devices
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = devices.booth_id AND b.tenant_id = devices.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = devices.booth_id AND b.tenant_id = devices.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_pairing_tokens_tenant ON public.pairing_tokens;
CREATE POLICY snapbox_pairing_tokens_tenant ON public.pairing_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = pairing_tokens.booth_id AND b.tenant_id = pairing_tokens.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = pairing_tokens.booth_id AND b.tenant_id = pairing_tokens.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_packages_tenant ON public.packages;
CREATE POLICY snapbox_packages_tenant ON public.packages
  FOR ALL TO authenticated
  USING (
    (booth_id IS NULL OR EXISTS (SELECT 1 FROM public.booths b WHERE b.id = packages.booth_id AND b.tenant_id = packages.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    (booth_id IS NULL OR EXISTS (SELECT 1 FROM public.booths b WHERE b.id = packages.booth_id AND b.tenant_id = packages.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_kiosk_themes_tenant ON public.kiosk_themes;
CREATE POLICY snapbox_kiosk_themes_tenant ON public.kiosk_themes
  FOR ALL TO authenticated
  USING (
    (booth_id IS NULL OR EXISTS (SELECT 1 FROM public.booths b WHERE b.id = kiosk_themes.booth_id AND b.tenant_id = kiosk_themes.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    (booth_id IS NULL OR EXISTS (SELECT 1 FROM public.booths b WHERE b.id = kiosk_themes.booth_id AND b.tenant_id = kiosk_themes.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_sessions_tenant ON public.sessions;
CREATE POLICY snapbox_sessions_tenant ON public.sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = sessions.booth_id AND b.tenant_id = sessions.tenant_id)
    AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = sessions.device_id AND d.tenant_id = sessions.tenant_id))
    AND (transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = sessions.transaction_id AND t.tenant_id = sessions.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = sessions.booth_id AND b.tenant_id = sessions.tenant_id)
    AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = sessions.device_id AND d.tenant_id = sessions.tenant_id))
    AND (transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = sessions.transaction_id AND t.tenant_id = sessions.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_transactions_tenant ON public.transactions;
CREATE POLICY snapbox_transactions_tenant ON public.transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = transactions.booth_id AND b.tenant_id = transactions.tenant_id)
    AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = transactions.device_id AND d.tenant_id = transactions.tenant_id))
    AND (package_id IS NULL OR EXISTS (SELECT 1 FROM public.packages p WHERE p.id = transactions.package_id AND p.tenant_id = transactions.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.booths b WHERE b.id = transactions.booth_id AND b.tenant_id = transactions.tenant_id)
    AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.devices d WHERE d.id = transactions.device_id AND d.tenant_id = transactions.tenant_id))
    AND (package_id IS NULL OR EXISTS (SELECT 1 FROM public.packages p WHERE p.id = transactions.package_id AND p.tenant_id = transactions.tenant_id))
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_download_tokens_tenant ON public.download_tokens;
CREATE POLICY snapbox_download_tokens_tenant ON public.download_tokens
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = download_tokens.transaction_id AND t.tenant_id = download_tokens.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = download_tokens.transaction_id AND t.tenant_id = download_tokens.tenant_id)
    AND (app.is_ceo() OR tenant_id = app.current_tenant_id())
  );

DROP POLICY IF EXISTS snapbox_promo_redemptions_tenant ON public.promo_redemptions;
CREATE POLICY snapbox_promo_redemptions_tenant ON public.promo_redemptions
  FOR ALL TO authenticated
  USING (
    app.is_ceo() OR (
      tenant_id = app.current_tenant_id()
      AND EXISTS (SELECT 1 FROM public.promos p WHERE p.id = promo_redemptions.promo_id AND (p.tenant_id = promo_redemptions.tenant_id OR p.tenant_id IS NULL))
      AND (transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = promo_redemptions.transaction_id AND t.tenant_id = promo_redemptions.tenant_id))
    )
  )
  WITH CHECK (
    app.is_ceo() OR (
      tenant_id = app.current_tenant_id()
      AND EXISTS (SELECT 1 FROM public.promos p WHERE p.id = promo_redemptions.promo_id AND (p.tenant_id = promo_redemptions.tenant_id OR p.tenant_id IS NULL))
      AND (transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = promo_redemptions.transaction_id AND t.tenant_id = promo_redemptions.tenant_id))
    )
  );

DROP POLICY IF EXISTS snapbox_promos_tenant ON public.promos;
CREATE POLICY snapbox_promos_tenant ON public.promos
  FOR ALL TO authenticated
  USING (app.is_ceo() OR (tenant_id IS NOT NULL AND tenant_id = app.current_tenant_id()))
  WITH CHECK (app.is_ceo() OR (tenant_id IS NOT NULL AND tenant_id = app.current_tenant_id()));

-- A booth-frame assignment joins two tenant parents, so both must be visible
-- to the caller and belong to the same tenant.
DROP POLICY IF EXISTS snapbox_booth_frames_parent ON public.booth_frames;
CREATE POLICY snapbox_booth_frames_parent ON public.booth_frames
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.booths b JOIN public.frames f ON f.id = booth_frames.frame_id
      WHERE b.id = booth_frames.booth_id AND b.tenant_id = f.tenant_id
        AND (app.is_ceo() OR b.tenant_id = app.current_tenant_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.booths b JOIN public.frames f ON f.id = booth_frames.frame_id
      WHERE b.id = booth_frames.booth_id AND b.tenant_id = f.tenant_id
        AND (app.is_ceo() OR b.tenant_id = app.current_tenant_id())
    )
  );

-- Parent lookup must not recurse into the child policy. The parent row is the
-- source of tenant truth; RLS already bounds which parent rows are visible.
DROP POLICY IF EXISTS snapbox_frame_versions_parent ON public.frame_versions;
CREATE POLICY snapbox_frame_versions_parent ON public.frame_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.frames f WHERE f.id = frame_versions.frame_id AND (app.is_ceo() OR f.tenant_id = app.current_tenant_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.frames f WHERE f.id = frame_versions.frame_id AND (app.is_ceo() OR f.tenant_id = app.current_tenant_id())));

DROP POLICY IF EXISTS snapbox_kiosk_theme_versions_parent ON public.kiosk_theme_versions;
CREATE POLICY snapbox_kiosk_theme_versions_parent ON public.kiosk_theme_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kiosk_themes k WHERE k.id = kiosk_theme_versions.theme_id AND (app.is_ceo() OR k.tenant_id = app.current_tenant_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kiosk_themes k WHERE k.id = kiosk_theme_versions.theme_id AND (app.is_ceo() OR k.tenant_id = app.current_tenant_id())));

DROP POLICY IF EXISTS snapbox_paper_logs_parent ON public.paper_logs;
CREATE POLICY snapbox_paper_logs_parent ON public.paper_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.booths b WHERE b.id = paper_logs.booth_id AND (app.is_ceo() OR b.tenant_id = app.current_tenant_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.booths b WHERE b.id = paper_logs.booth_id AND (app.is_ceo() OR b.tenant_id = app.current_tenant_id())));

-- Runtime registry is public-read only. Writes remain platform/service-only.
REVOKE ALL ON TABLE public.camera_compatibility FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.camera_compatibility FROM authenticated;
GRANT SELECT ON TABLE public.camera_compatibility TO anon, authenticated;
DROP POLICY IF EXISTS snapbox_camera_compatibility_public_read ON public.camera_compatibility;
CREATE POLICY snapbox_camera_compatibility_public_read ON public.camera_compatibility
  FOR SELECT TO anon, authenticated USING (true);

-- Calibration has no tenant key: no authenticated or anon table privileges.
REVOKE ALL ON TABLE public.device_calibrations FROM anon, authenticated;
