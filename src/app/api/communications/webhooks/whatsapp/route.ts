/**
 * =============================================================================
 * WHATSAPP WEBHOOK ENDPOINT — NEXT.JS APP ROUTER
 * =============================================================================
 *
 * Entry point for WhatsApp Cloud API webhooks:
 * - GET: Webhook verification (hub.challenge)
 * - POST: Incoming messages + status updates
 *
 * @module api/communications/webhooks/whatsapp/route
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

import { handleGET, handlePOST } from './handler';
import { createMetaWebhookRoute } from '@/lib/communications/meta-webhook';

/**
 * Vercel Serverless Function max duration.
 * WhatsApp webhook processing includes CRM store operations.
 * Future: AI pipeline will run inside after() (same as Telegram).
 * @enterprise Required for full pipeline execution
 */
export const maxDuration = 60;

/**
 * GET  — Webhook verification (Meta sends hub.challenge once at configuration).
 * POST — Incoming messages, delivery receipts, and errors.
 *
 * Wiring (rate limit WEBHOOK 30 req/min on both verbs) is owned by the shared
 * Meta webhook route factory (ADR-586).
 */
export const { GET, POST } = createMetaWebhookRoute({ handleGET, handlePOST });
