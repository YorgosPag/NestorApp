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

import { type NextRequest, NextResponse } from 'next/server';
import { handleGET, handlePOST } from './handler';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * Vercel Serverless Function max duration.
 * WhatsApp webhook processing includes CRM store operations.
 * Future: AI pipeline will run inside after() (same as Telegram).
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
 * POST — Incoming messages and status updates
 * Meta sends message events, delivery receipts, and errors here.
 *
 * @rateLimit WEBHOOK (30 req/min)
 */
async function postHandler(request: NextRequest): Promise<NextResponse> {
  return handlePOST(request);
}

export const POST = withWebhookRateLimit(postHandler);
