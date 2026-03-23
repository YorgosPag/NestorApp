/**
 * =============================================================================
 * SENTRY ERROR CAPTURE — Centralized Helpers
 * =============================================================================
 *
 * SSoT for all Sentry error/warning capture across the application.
 * Uses dynamic import to avoid bundling Sentry in non-production builds.
 * All captures are non-fatal: failure to report never breaks the app.
 *
 * @module lib/telemetry/sentry
 * @enterprise ADR-259D — Production Readiness Audit
 */

interface SentryContext {
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Capture an exception in Sentry (for unexpected errors).
 * Non-fatal: silently ignores if Sentry is unavailable.
 */
export function captureException(error: unknown, context: SentryContext): void {
  import('@sentry/nextjs').then(Sentry => {
    Sentry.captureException(error, {
      tags: context.tags,
      extra: context.extra,
    });
  }).catch(() => { /* non-fatal: Sentry unavailable */ });
}

/**
 * Capture a message in Sentry (for expected warnings/info).
 * Non-fatal: silently ignores if Sentry is unavailable.
 */
export function captureMessage(
  message: string,
  level: 'warning' | 'error' | 'info',
  context: SentryContext,
): void {
  import('@sentry/nextjs').then(Sentry => {
    Sentry.captureMessage(message, {
      level,
      tags: context.tags,
      extra: context.extra,
    });
  }).catch(() => { /* non-fatal: Sentry unavailable */ });
}
