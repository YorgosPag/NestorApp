/**
 * @file Console Logger Adapter - LoggerPort Implementation
 * @module settings/sync/adapters/consoleLoggerAdapter
 *
 * ✅ ENTERPRISE: Adapter Pattern - Console.log → LoggerPort
 *
 * **RESPONSIBILITY**: Provide LoggerPort implementation using console
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import type { LoggerPort } from '../ports';

/**
 * Console Logger Adapter
 *
 * Simple logger implementation using console.* methods
 *
 * @example
 * ```ts
 * const syncDeps = { logger: consoleLoggerAdapter };
 * ```
 */
export const consoleLoggerAdapter: LoggerPort = {
  info(msg: string, data?: unknown) {
    if (data !== undefined) {
      console.log(`[INFO] ${msg}`, data);
    } else {
      console.log(`[INFO] ${msg}`);
    }
  },

  warn(msg: string, data?: unknown) {
    if (data !== undefined) {
      console.warn(`[WARN] ${msg}`, data);
    } else {
      console.warn(`[WARN] ${msg}`);
    }
  },

  error(msg: string, data?: unknown) {
    if (data !== undefined) {
      console.error(`[ERROR] ${msg}`, data);
    } else {
      console.error(`[ERROR] ${msg}`);
    }
  }
};

/**
 * Silent Logger Adapter (for tests)
 *
 * No-op implementation for unit tests
 */
export const silentLoggerAdapter: LoggerPort = {
  info() { /* no-op */ },
  warn() { /* no-op */ },
  error() { /* no-op */ }
};
