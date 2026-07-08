/**
 * =============================================================================
 * INSTAGRAM WEBHOOK ENDPOINT — NEXT.JS APP ROUTER
 * =============================================================================
 *
 * Entry point for Instagram Messaging API webhooks:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming DMs + read receipts
 *
 * @module api/communications/webhooks/instagram/route
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 */

import { handleGET, handlePOST } from './handler';
import { createMetaWebhookRoute } from '@/lib/communications/meta-webhook';

/**
 * Vercel Serverless Function max duration.
 * Instagram webhook processing includes CRM store + AI pipeline via after().
 * @enterprise Required for full pipeline execution
 */
export const maxDuration = 60;

/**
 * GET  — Webhook verification (Meta sends hub.challenge once at configuration).
 * POST — Incoming DM events and read receipts.
 *
 * Wiring (rate limit WEBHOOK 30 req/min on both verbs) is owned by the shared
 * Meta webhook route factory (ADR-586).
 */
export const { GET, POST } = createMetaWebhookRoute({ handleGET, handlePOST });
