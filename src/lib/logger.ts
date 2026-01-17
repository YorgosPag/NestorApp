/**
 * 🔧 CENTRALIZED LOGGER - Enterprise Logging Policy
 *
 * Production-safe logging με environment-based behavior.
 * Replaces scattered console.* calls with centralized policy.
 *
 * @module lib/logger
 * @enterprise Addresses BLOCKER #4: Console logging in production
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Log levels for structured logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Centralized logger με production safety.
 *
 * **Behavior:**
 * - Production: Only errors logged (silent info/debug)
 * - Development: Full logging enabled
 *
 * **Usage:**
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info('User loaded', { userId, companyId }); // Silent in production
 * logger.error('API failed', error); // Always logged
 * ```
 */
export const logger = {
  /**
   * Debug-level logging (dev only).
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (IS_DEV) {
      console.log(`🔍 ${message}`, ...args);
    }
  },

  /**
   * Info-level logging (dev only).
   */
  info: (message: string, ...args: unknown[]): void => {
    if (IS_DEV) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },

  /**
   * Warning-level logging (always enabled).
   */
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`⚠️ ${message}`, ...args);
  },

  /**
   * Error-level logging (always enabled).
   */
  error: (message: string, ...args: unknown[]): void => {
    console.error(`❌ ${message}`, ...args);
  },
};

/**
 * Development-only helper (silent in production).
 * Use for verbose debugging that shouldn't appear in production logs.
 *
 * @example
 * devLog('Intermediate calculation result:', intermediateValue);
 */
export function devLog(message: string, ...args: unknown[]): void {
  if (IS_DEV) {
    console.log(`🛠️ ${message}`, ...args);
  }
}
