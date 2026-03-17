/**
 * Sentry Edge Runtime Configuration
 * FULL COVERAGE: Middleware errors, edge API routes, console, request data.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),

  // Performance: 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter noise
  ignoreErrors: [
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],

  integrations: [
    // 1. CONSOLE: Captures console.error and console.warn
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),

    // 2. EXTRA ERROR DATA: Enriches errors with deep context
    Sentry.extraErrorDataIntegration({
      depth: 5,
    }),

    // 3. REQUEST DATA: HTTP request context (URL, headers, method)
    Sentry.requestDataIntegration(),
  ],

  // Attach stack traces
  attachStacktrace: true,

  // Send request data for debugging
  sendDefaultPii: true,

  // Before sending: enrich with edge context
  beforeSend(event) {
    event.tags = {
      ...event.tags,
      runtime: 'edge',
    };
    return event;
  },
});
