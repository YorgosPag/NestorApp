/**
 * Sentry Test Endpoint — Verify Sentry integration is working
 *
 * GET /api/debug/sentry-test → sends a test error to Sentry
 * DELETE later once confirmed working
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Method 1: Capture a manual exception
    const testError = new Error('[Sentry Test] Verification error from /api/debug/sentry-test');
    Sentry.captureException(testError);

    // Method 2: Capture a message
    Sentry.captureMessage('[Sentry Test] Manual test message — connection verified', 'info');

    // Flush to ensure events are sent before response
    await Sentry.flush(5000);

    return NextResponse.json({
      success: true,
      message: 'Test error + message sent to Sentry. Check dashboard in 1-2 minutes.',
      timestamp: new Date().toISOString(),
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'MISSING',
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
