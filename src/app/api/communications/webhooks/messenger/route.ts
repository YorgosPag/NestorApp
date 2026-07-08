/**
 * =============================================================================
 * MESSENGER WEBHOOK ENDPOINT — NEXT.JS APP ROUTER
 * =============================================================================
 *
 * Entry point for Facebook Messenger Platform webhooks:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming messages, delivery receipts, read receipts
 *
 * @module api/communications/webhooks/messenger/route
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 */

import { handleGET, handlePOST } from './handler';
import { createMetaWebhookRoute } from '@/lib/communications/meta-webhook';

/**
 * Vercel Serverless Function max duration.
 * Messenger webhook processing includes CRM store + AI pipeline via after().
 * @enterprise Required for full pipeline execution
 */
export const maxDuration = 60;

/**
 * GET  — Webhook verification (Meta sends hub.challenge once at configuration).
 * POST — Incoming messages, delivery receipts, and read events.
 *
 * Wiring (rate limit WEBHOOK 30 req/min on both verbs) is owned by the shared
 * Meta webhook route factory (ADR-586).
 */
export const { GET, POST } = createMetaWebhookRoute({ handleGET, handlePOST });
