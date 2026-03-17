/**
 * Sentry Client-Side Configuration
 * FULL COVERAGE: errors, performance, Web Vitals, Long Tasks, HTTP, console, crashes.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// 🔇 SENTRY DISABLED (2026-03-17) — re-enable with Vercel Pro
// import * as Sentry from '@sentry/nextjs';

/* Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),

  // Performance: 20% in production (covers Web Vitals, Long Tasks, INP)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Profiling: 10% in production (CPU profiling per transaction)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay: 2% normally, 100% on error
  replaysSessionSampleRate: 0.02,
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

  // Deny URLs from noisy external sources
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
  ],

  integrations: [
    // 1. PERFORMANCE: Web Vitals (LCP, FCP, CLS, INP, TTFB) + Long Tasks + routing
    //    Automatically captures: page loads, navigations, web vitals, long tasks
    Sentry.browserTracingIntegration(),

    // 2. SESSION REPLAY: Visual reproduction of errors
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),

    // 3. HTTP CLIENT: Captures failed HTTP requests (4xx, 5xx) as errors
    Sentry.httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
    }),

    // 4. REPORTING OBSERVER: Browser deprecations, interventions, crashes
    Sentry.reportingObserverIntegration({
      types: ['crash', 'deprecation', 'intervention'],
    }),

    // 5. CONSOLE: Captures console.error and console.warn as breadcrumbs
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),

    // 6. EXTRA ERROR DATA: Enriches errors with additional context
    Sentry.extraErrorDataIntegration({
      depth: 5,
    }),

    // 7. BROWSER PROFILING: CPU profiling per transaction
    Sentry.browserProfilingIntegration(),
  ],

  // Attach stack traces to non-error messages
  attachStacktrace: true,

  // Send default PII (IP, user agent) for better debugging
  sendDefaultPii: true,

  // Before sending: enrich with custom context
  beforeSend(event) {
    // Add viewport info for UI/performance debugging
    if (typeof window !== 'undefined') {
      event.contexts = {
        ...event.contexts,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
      };
    }
    return event;
  },

  // Before sending transaction: tag slow transactions
  beforeSendTransaction(event) {
    const duration = event.timestamp && event.start_timestamp
      ? (event.timestamp - event.start_timestamp) * 1000
      : 0;

    if (duration > 3000) {
      event.tags = { ...event.tags, slow_transaction: 'true' };
    }
    return event;
  },
}); */
