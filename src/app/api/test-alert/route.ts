/**
 * TEMPORARY test endpoint for Telegram alert verification.
 * DELETE after testing.
 */

import { NextResponse } from 'next/server';
import { sendTelegramAlert } from '@/lib/telemetry/telegram-alert-service';

export async function GET(): Promise<NextResponse> {
  await sendTelegramAlert('error', 'TestAlertRoute', 'Test alert — verifying Telegram monitoring is active', {
    test: 'true',
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, message: 'Alert sent. Check Telegram.' });
}
