// /home/user/studio/src/app/api/communications/webhooks/telegram/route.ts

import { type NextRequest, NextResponse } from 'next/server';
import { handlePOST, handleGET } from './handler';

/**
 * Handles POST requests to the Telegram webhook endpoint.
 * This is the main entry point for incoming messages from Telegram.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePOST(request);
}

/**
 * Handles GET requests to the Telegram webhook endpoint.
 * Used for health checks and verifying endpoint status.
 */
export async function GET(): Promise<NextResponse> {
    return handleGET();
}
// trigger rebuild 1768323048
