/**
 * Server-only Supabase Realtime publisher.
 *
 * Uses the Realtime HTTP endpoint instead of the browser client so the service
 * role key never crosses the client boundary. Channel and event shapes remain
 * owned by `@snapbox/shared/events`.
 */
import 'server-only';

import {
  REALTIME_CHANNELS,
  realtimeEventSchema,
  type RealtimeChannel,
  type RealtimeEvent,
} from '@snapbox/shared/events';
import { parseEnv, publicEnvSchema, serverEnvSchema } from '@snapbox/shared/env';

const realtimeUrlSchema = publicEnvSchema.pick({ NEXT_PUBLIC_SUPABASE_URL: true });
const realtimeKeySchema = serverEnvSchema.pick({ SUPABASE_SERVICE_ROLE_KEY: true });

export { REALTIME_CHANNELS };

export type RealtimePublishInput = Readonly<{
  channel: RealtimeChannel;
  event: RealtimeEvent;
}>;

function getRealtimeConfig(): Readonly<{ url: string; serviceRoleKey: string }> {
  const url = parseEnv(realtimeUrlSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const key = parseEnv(realtimeKeySchema, {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!url.success || !url.data || !key.success || !key.data) {
    throw new Error('Supabase Realtime server configuration is invalid.');
  }

  const parsedUrl = new URL(url.data.NEXT_PUBLIC_SUPABASE_URL);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Supabase Realtime server URL must use HTTPS.');
  }

  return {
    url: parsedUrl.toString().replace(/\/$/, ''),
    serviceRoleKey: key.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/** Publishes one validated, idempotent event to a Supabase Realtime channel. */
export async function publishRealtimeEvent(input: RealtimePublishInput): Promise<void> {
  const event = realtimeEventSchema.parse(input.event);
  const config = getRealtimeConfig();
  const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          topic: input.channel,
          event: event.name,
          payload: event,
        },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Supabase Realtime publish failed (${response.status}).`);
  }
}
