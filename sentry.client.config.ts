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
});
