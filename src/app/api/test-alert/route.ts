/**
 * TEMPORARY test endpoint for Telegram alert verification.
 * DELETE after testing.
 */

import { NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('TestAlertRoute');

export async function GET(): Promise<NextResponse> {
  // This will trigger TelegramAlertOutput in production
  logger.error('Test alert — verifying Telegram monitoring is active', {
    test: true,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, message: 'Test error logged. Check Telegram.' });
}
