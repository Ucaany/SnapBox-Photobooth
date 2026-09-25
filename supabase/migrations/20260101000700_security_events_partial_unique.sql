-- Forward-only reconciliation for Drizzle/Supabase schema parity.
DROP INDEX IF EXISTS public.security_events_provider_event_idx;
CREATE UNIQUE INDEX IF NOT EXISTS security_events_provider_event_idx
  ON public.security_events(source, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
