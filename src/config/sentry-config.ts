/**
 * =============================================================================
 * SENTRY CONFIGURATION — SSoT for all Sentry init parameters
 * =============================================================================
 *
 * Shared across sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts.
 * Change values HERE — all 3 runtimes pick them up automatically.
 *
 * @module config/sentry-config
 * @enterprise ADR-259D — Production Readiness Audit
 */

/** 10% performance sampling (sufficient for error detection, minimal overhead) */
export const SENTRY_TRACES_SAMPLE_RATE = 0.1;

/** Only send errors in production */
export const SENTRY_ENABLED = process.env.NODE_ENV === 'production';

/** Session replay: disabled for privacy */
export const SENTRY_REPLAYS_SESSION_SAMPLE_RATE = 0;

/** 50% replay capture on error (for debugging) */
export const SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE = 0.5;
