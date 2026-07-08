/**
 * =============================================================================
 * META WEBHOOK ROUTE FACTORY — SHARED SSoT
 * =============================================================================
 *
 * Single Source of Truth for wiring a Meta webhook Next.js App Router route.
 * Every Meta platform route (Instagram / Messenger / WhatsApp) exposes the same
 * shape: a rate-limited GET (verification handshake) and a rate-limited POST
 * (incoming events), both delegating to the platform's `handler.ts`. Only the
 * per-platform handlers differ — this factory owns the wrapping.
 *
 * NOTE: `export const maxDuration` MUST stay a static top-level export in each
 * `route.ts` (Next.js reads it statically) — it cannot be supplied by this factory.
 *
 * @module lib/communications/meta-webhook/meta-webhook-route
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import { type NextRequest, type NextResponse } from 'next/server';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

/** A platform webhook handler: verification (GET) or event ingestion (POST). */
export type MetaWebhookHandler = (request: NextRequest) => Promise<NextResponse>;

/** The per-platform handlers wired by {@link createMetaWebhookRoute}. */
export interface MetaWebhookHandlers {
  /** GET — webhook verification (`hub.challenge` echo). */
  handleGET: MetaWebhookHandler;
  /** POST — incoming messages and events. */
  handlePOST: MetaWebhookHandler;
}

/** The rate-limited route exports consumed by Next.js App Router. */
export interface MetaWebhookRoute {
  GET: MetaWebhookHandler;
  POST: MetaWebhookHandler;
}

/**
 * Build the rate-limited `{ GET, POST }` route exports for a Meta webhook.
 *
 * Usage in a platform `route.ts`:
 * ```ts
 * export const maxDuration = 60;
 * export const { GET, POST } = createMetaWebhookRoute({ handleGET, handlePOST });
 * ```
 *
 * @rateLimit WEBHOOK (30 req/min) on both verbs.
 */
export function createMetaWebhookRoute({ handleGET, handlePOST }: MetaWebhookHandlers): MetaWebhookRoute {
  return {
    GET: withWebhookRateLimit(handleGET),
    POST: withWebhookRateLimit(handlePOST),
  };
}
