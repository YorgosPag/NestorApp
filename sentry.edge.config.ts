/**
 * Sentry Edge Runtime Configuration
 * @see SPEC-259D (ADR-259 Production Readiness Audit)
 * @see src/config/sentry-config.ts for shared SSoT values
 */
import * as Sentry from '@sentry/nextjs';
import { SENTRY_TRACES_SAMPLE_RATE, SENTRY_ENABLED } from '@/config/sentry-config';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  enabled: SENTRY_ENABLED,
});
