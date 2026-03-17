/**
 * Sentry Test Endpoint — Verify Sentry integration is working
 *
 * GET /api/debug/sentry-test → sends a test error to Sentry
 * DELETE later once confirmed working
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  const nodeEnv = process.env.NODE_ENV;
  const nextRuntime = process.env.NEXT_RUNTIME;

  // Check if client is already initialized
  let client = Sentry.getClient();
  let wasAlreadyInitialized = !!client;

  // If not initialized, do it now (fallback for instrumentation issues)
  if (!client && dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1.0,
      enabled: true,
      environment: nodeEnv,
    });
    client = Sentry.getClient();
  }

  const clientDsn = client?.getDsn();

  try {
    // Capture a manual exception
    const testError = new Error('[Sentry Test] Verification error from /api/debug/sentry-test');
    const eventId1 = Sentry.captureException(testError);

    // Capture a message
    const eventId2 = Sentry.captureMessage('[Sentry Test] Manual test message — connection verified', 'info');

    // Flush to ensure events are sent before response
    const flushed = await Sentry.flush(5000);

    return NextResponse.json({
      success: true,
      message: 'Test error + message sent to Sentry. Check dashboard in 1-2 minutes.',
      debug: {
        timestamp: new Date().toISOString(),
        dsnConfigured: !!dsn,
        dsnPrefix: dsn ? dsn.substring(0, 30) + '...' : 'MISSING',
        environment: nodeEnv,
        nextRuntime,
        wasAlreadyInitialized,
        sentryClientInitialized: !!client,
        sentryClientDsn: clientDsn ? `${clientDsn.protocol}://${clientDsn.host}` : 'none',
        sentryEnabled: client?.getOptions()?.enabled ?? false,
        eventId1,
        eventId2,
        flushed,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
