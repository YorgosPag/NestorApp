/**
 * Sentry Client-Side Configuration
 * @see SPEC-259D (ADR-259 Production Readiness Audit)
 * @see src/config/sentry-config.ts for shared SSoT values
 */
import * as Sentry from '@sentry/nextjs';
import {
  SENTRY_TRACES_SAMPLE_RATE,
  SENTRY_ENABLED,
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
} from '@/config/sentry-config';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  replaysSessionSampleRate: SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  replaysOnErrorSampleRate: SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  enabled: SENTRY_ENABLED,
  // Drop known Session Replay race condition in SDK 10.45.0.
  // The Replay integration occasionally calls Range.selectNode() on DOM nodes
  // that were detached mid-snapshot (common on /properties during re-renders).
  // Fixed upstream in @sentry/nextjs >= 10.50 — remove this filter after upgrade.
  beforeSend(event, hint) {
    const error = hint?.originalException;
    if (error instanceof Error && error.message?.includes('selectNode')) {
      return null;
    }
    return event;
  },
});
