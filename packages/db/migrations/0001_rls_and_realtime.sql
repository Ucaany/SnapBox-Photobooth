-- Task 0.8: application RLS and booth Realtime authorization.
-- Run after supabase/migrations/* and the generated Drizzle baseline.

-- Enable RLS for every application table through the helper owned by Task 0.4.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'tenants', 'plans', 'b2b_subscriptions', 'outlets', 'booths',
    'devices', 'pairing_tokens', 'device_calibrations', 'frames',
    'frame_versions', 'booth_frames', 'templates', 'packages', 'kiosk_themes',
    'kiosk_theme_versions', 'promos', 'promo_redemptions', 'b2c_payment_configs',
    'transactions', 'activity_logs', 'notifications', 'broadcasts', 'paper_logs',
    'webhook_events', 'webhook_failures', 'device_logs', 'camera_compatibility',
    'sessions', 'customers', 'download_tokens'
  ]
  loop
    perform app.enforce_rls('public.' || table_name);
  end loop;
end
$$;

-- Direct application access is still constrained by the policies below.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Tenant-owned tables. Nullable tenant IDs deliberately exclude platform rows.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'b2b_subscriptions', 'outlets', 'booths', 'devices',
    'pairing_tokens', 'frames', 'templates', 'packages', 'kiosk_themes',
    'promos', 'promo_redemptions', 'b2c_payment_configs', 'transactions',
    'activity_logs', 'device_logs', 'sessions', 'customers', 'download_tokens'
  ]
  loop
    execute format('drop policy if exists snapbox_%I_tenant on public.%I', table_name, table_name);
    execute format(
      'create policy snapbox_%I_tenant on public.%I for all to authenticated using (app.is_ceo() or (tenant_id is not null and tenant_id = app.current_tenant_id())) with check (app.is_ceo() or (tenant_id is not null and tenant_id = app.current_tenant_id()))',
      table_name, table_name
    );
  end loop;
end
$$;

drop policy if exists snapbox_tenants_scope on public.tenants;
create policy snapbox_tenants_scope on public.tenants
  for all to authenticated
  using (app.is_ceo() or id = app.current_tenant_id())
  with check (app.is_ceo() or id = app.current_tenant_id());

-- Child tables inherit tenant scope from their parent. No tenant_id is added to
-- these tables because the parent foreign key is the source of truth.
do $$
declare
  relationship record;
begin
  for relationship in
    select * from (values
      ('frame_versions', 'frames', 'frame_id'),
      ('booth_frames', 'booths', 'booth_id'),
      ('kiosk_theme_versions', 'kiosk_themes', 'theme_id'),
      ('paper_logs', 'booths', 'booth_id')
    ) as links(child_table, parent_table, parent_column)
  loop
    execute format('drop policy if exists snapbox_%I_parent on public.%I', relationship.child_table, relationship.child_table);
    execute format(
      'create policy snapbox_%I_parent on public.%I for all to authenticated using (exists (select 1 from public.%I parent where parent.id = %I.%I and (app.is_ceo() or parent.tenant_id = app.current_tenant_id()))) with check (exists (select 1 from public.%I parent where parent.id = %I.%I and (app.is_ceo() or parent.tenant_id = app.current_tenant_id())))',
      relationship.child_table, relationship.child_table, relationship.parent_table, relationship.child_table, relationship.parent_column,
      relationship.parent_table, relationship.child_table, relationship.parent_column
    );
  end loop;
end
$$;

-- Users policy intentionally does not call app.is_ceo(), avoiding recursive RLS
-- evaluation inside app.is_ceo()'s server-side confirmation query.
drop policy if exists snapbox_users_scope on public.users;
create policy snapbox_users_scope on public.users
  for all to authenticated
  using (
    (tenant_id is not null and tenant_id = app.current_tenant_id())
    or (tenant_id is null and firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'))
  )
  with check (
    tenant_id is not null and tenant_id = app.current_tenant_id()
  );

-- Notifications are scoped by tenant or by the Firebase subject mapped through
-- the internal users table for platform notifications.
drop policy if exists snapbox_notifications_scope on public.notifications;
create policy snapbox_notifications_scope on public.notifications
  for all to authenticated
  using (
    (tenant_id is not null and tenant_id = app.current_tenant_id())
    or (
      tenant_id is null
      and exists (
        select 1 from public.users u
        where u.id = notifications.user_id
          and u.firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')
      )
    )
  )
  with check (
    (tenant_id is not null and tenant_id = app.current_tenant_id())
    or (
      tenant_id is null
      and exists (
        select 1 from public.users u
        where u.id = notifications.user_id
          and u.firebase_uid = (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')
      )
    )
  );

-- Device calibration has no tenant column and remains service-layer-only.
drop policy if exists snapbox_device_calibrations_authenticated on public.device_calibrations;

-- Platform-only tables. CEO access is explicit; service_role remains the normal
-- server path for webhook and camera registry writes.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'plans', 'broadcasts', 'webhook_events', 'webhook_failures', 'camera_compatibility'
  ]
  loop
    execute format('drop policy if exists snapbox_%I_ceo on public.%I', table_name, table_name);
    execute format(
      'create policy snapbox_%I_ceo on public.%I for all to authenticated using (app.is_ceo()) with check (app.is_ceo())',
      table_name, table_name
    );
  end loop;
end
$$;

-- Realtime booth channels are created only after public.booths exists. Keep the
-- extension predicate so presence messages cannot inherit broadcast access.
do $$
begin
  if to_regclass('realtime.messages') is null or to_regprocedure('realtime.topic()') is null then
    raise notice 'Realtime booth policy skipped: realtime.messages or realtime.topic() unavailable';
    return;
  end if;

  execute 'drop policy if exists snapbox_realtime_booth_select on realtime.messages';
  execute $policy$
    create policy snapbox_realtime_booth_select on realtime.messages
      for select to authenticated
      using (
        realtime.messages.extension = 'broadcast'
        and realtime.topic() like 'booth:%'
        and exists (
          select 1
            from public.booths b
           where b.id::text = split_part(realtime.topic(), ':', 2)
             and (app.is_ceo() or b.tenant_id = app.current_tenant_id())
        )
      )
  $policy$;
end
$$;
