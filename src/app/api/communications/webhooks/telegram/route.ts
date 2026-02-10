// /home/user/studio/src/app/api/communications/webhooks/telegram/route.ts

import { type NextRequest, NextResponse } from 'next/server';
import { handlePOST, handleGET } from './handler';
import { withTelegramRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * Vercel Serverless Function max duration.
 * The AI pipeline runs TWO OpenAI calls inside after() (intent + reply),
 * which exceeds the default 10s on Hobby plan.
 * @enterprise Required for full pipeline execution via after() callback
 */
export const maxDuration = 60;

/**
 * Handles POST requests to the Telegram webhook endpoint.
 * This is the main entry point for incoming messages from Telegram.
 *
 * @rateLimit TELEGRAM (15 req/min) - Telegram webhook incoming messages
 */
async function postHandler(request: NextRequest): Promise<NextResponse> {
  return handlePOST(request);
}

export const POST = withTelegramRateLimit(postHandler);

/**
 * Handles GET requests to the Telegram webhook endpoint.
 * Used for health checks and verifying endpoint status.
 *
 * @rateLimit TELEGRAM (15 req/min) - Health check endpoint
 */
async function getHandler(): Promise<NextResponse> {
    return handleGET();
}

export const GET = withTelegramRateLimit(getHandler);
// trigger rebuild 1768323048
