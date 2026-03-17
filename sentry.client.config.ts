/**
 * Sentry Client-Side Configuration
 * Captures browser errors, unhandled rejections, and performance data.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),

  // Performance: Sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay: Capture 1% normally, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter noise — ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /^ResizeObserver loop/,
    // Network flakiness
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    // Firebase auth (handled by app)
    'auth/network-request-failed',
    'auth/popup-closed-by-user',
    // Next.js navigation (not real errors)
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],

  integrations: [
    Sentry.replayIntegration(),
  ],
});
