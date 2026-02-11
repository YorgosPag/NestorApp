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

import { type NextRequest, NextResponse } from 'next/server';
import { handleGET, handlePOST } from './handler';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * Vercel Serverless Function max duration.
 * Messenger webhook processing includes CRM store + AI pipeline via after().
 * @enterprise Required for full pipeline execution
 */
export const maxDuration = 60;

/**
 * GET — Webhook verification
 * Meta sends this once when configuring the webhook URL.
 * Must respond with hub.challenge to confirm ownership.
 *
 * @rateLimit WEBHOOK (30 req/min)
 */
async function getHandler(request: NextRequest): Promise<NextResponse> {
  return handleGET(request);
}

export const GET = withWebhookRateLimit(getHandler);

/**
 * POST — Incoming messages and events
 * Meta sends message events, delivery receipts, and read events here.
 *
 * @rateLimit WEBHOOK (30 req/min)
 */
async function postHandler(request: NextRequest): Promise<NextResponse> {
  return handlePOST(request);
}

export const POST = withWebhookRateLimit(postHandler);
