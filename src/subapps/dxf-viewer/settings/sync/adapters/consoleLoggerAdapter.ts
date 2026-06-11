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
import { createModuleLogger } from '@/lib/telemetry';

// SSoT logger (ADR-036) — replaces raw console.* so settings-sync logs honour the
// side-aware default (browser WARN / server INFO) + LOG_LEVEL override instead of
// always printing.
const logger = createModuleLogger('SettingsSync');

/**
 * Console Logger Adapter — `LoggerPort` backed by the centralized Logger SSoT.
 *
 * @example
 * ```ts
 * const syncDeps = { logger: consoleLoggerAdapter };
 * ```
 */
export const consoleLoggerAdapter: LoggerPort = {
  info(msg: string, data?: unknown) {
    if (data !== undefined) {
      logger.info(msg, data);
    } else {
      logger.info(msg);
    }
  },

  warn(msg: string, data?: unknown) {
    if (data !== undefined) {
      logger.warn(msg, data);
    } else {
      logger.warn(msg);
    }
  },

  error(msg: string, data?: unknown) {
    if (data !== undefined) {
      logger.error(msg, data);
    } else {
      logger.error(msg);
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
