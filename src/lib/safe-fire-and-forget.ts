/**
 * =============================================================================
 * ENTERPRISE: Safe Fire-and-Forget Utility
 * =============================================================================
 *
 * Canonical replacement for `.catch(() => {})` patterns.
 * Ensures fire-and-forget promises are logged on failure
 * without blocking the caller.
 *
 * - Server: logs via createModuleLogger (auto-Telegram alerts)
 * - Client: logs via console.error
 *
 * @module lib/safe-fire-and-forget
 * @see ADR-253 (Security & Data Integrity Audit)
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('FIRE_AND_FORGET');

/**
 * Server-side fire-and-forget with structured logging.
 * Failures are logged (with auto-Telegram via CompositeOutput) but never thrown.
 */
export function safeFireAndForget(
  promise: Promise<unknown>,
  context: string,
  metadata?: Record<string, unknown>,
): void {
  promise.catch((error: unknown) => {
    logger.error(`[${context}] Fire-and-forget failed`, {
      error: getErrorMessage(error),
      ...metadata,
    });
  });
}

/**
 * Client-side fire-and-forget with console logging.
 * Safe for React components and hooks — no server dependencies.
 */
export function clientSafeFireAndForget(
  promise: Promise<unknown>,
  context: string,
  metadata?: Record<string, unknown>,
): void {
  promise.catch((error: unknown) => {
    console.error(`[${context}] Fire-and-forget failed:`, getErrorMessage(error), metadata);
  });
}
