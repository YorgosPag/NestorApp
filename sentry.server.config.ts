/**
 * Sentry Server-Side Configuration
 * FULL COVERAGE: API errors, SSR, unhandled exceptions, HTTP, Firestore, console, AI calls.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// 🔇 SENTRY DISABLED (2026-03-17) — re-enable with Vercel Pro
// import * as Sentry from '@sentry/nextjs';

/* Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),

  // Performance: 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Profiling: 10% in production (Node.js CPU profiling)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Environment tag
  environment: process.env.NODE_ENV,

  // Filter noise
  ignoreErrors: [
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
    'ECONNRESET',
    'EPIPE',
  ],

  integrations: [
    // 1. HTTP: Traces all outgoing HTTP requests (Firestore, external APIs)
    Sentry.httpIntegration(),

    // 2. FIREBASE: Traces Firestore queries, auth, storage operations
    Sentry.firebaseIntegration(),

    // 3. OPENAI: Traces AI API calls (gpt-4o-mini, embeddings)
    Sentry.openAIIntegration(),

    // 4. CONSOLE: Captures console.error and console.warn
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),

    // 5. EXTRA ERROR DATA: Enriches errors with deep context
    Sentry.extraErrorDataIntegration({
      depth: 5,
    }),

    // 6. CONTEXT LINES: Source code context around errors
    Sentry.contextLinesIntegration(),

    // 7. LOCAL VARIABLES: Captures local variable values in stack frames
    Sentry.localVariablesIntegration(),

    // 8. ANR: Application Not Responding detection (blocked event loop)
    Sentry.anrIntegration({
      captureStackTrace: true,
    }),

    // 9. FS: Traces file system operations
    Sentry.fsIntegration(),

    // 10. FETCH: Traces native Node.js fetch requests
    Sentry.nativeNodeFetchIntegration(),

    // 11. REQUEST DATA: Enriches errors with HTTP request data (headers, body)
    Sentry.requestDataIntegration(),

    // 12. UNHANDLED EXCEPTIONS: Catches all uncaught errors
    Sentry.onUncaughtExceptionIntegration(),

    // 13. UNHANDLED REJECTIONS: Catches all unhandled promise rejections
    Sentry.onUnhandledRejectionIntegration(),
  ],

  // Attach stack traces to non-error messages
  attachStacktrace: true,

  // Send request data for debugging
  sendDefaultPii: true,

  // Before sending: enrich with server context
  beforeSend(event) {
    // Add Node.js runtime info
    event.contexts = {
      ...event.contexts,
      runtime: {
        name: 'node',
        version: process.version,
      },
      app: {
        app_memory: process.memoryUsage().rss,
      },
    };
    return event;
  },

  // Tag slow server transactions (>5s)
  beforeSendTransaction(event) {
    const duration = event.timestamp && event.start_timestamp
      ? (event.timestamp - event.start_timestamp) * 1000
      : 0;

    if (duration > 5000) {
      event.tags = { ...event.tags, slow_transaction: 'true' };
    }
    return event;
  },
}); */
