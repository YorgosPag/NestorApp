/**
 * TEMPORARY diagnostic endpoint. DELETE after testing.
 */

import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({
    ok: true,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      botTokenPrefix: process.env.TELEGRAM_BOT_TOKEN?.substring(0, 5) ?? 'MISSING',
      chatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? 'NOT_SET (will use default)',
    },
  });
}
