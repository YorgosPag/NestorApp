/**
 * =============================================================================
 * CANONICAL ENTERPRISE LOGGER
 * =============================================================================
 *
 * @file Structured Logger - App-wide canonical logging system
 * @module lib/telemetry/Logger
 *
 * ENTERPRISE STANDARD - Production-grade logging
 *
 * **FEATURES:**
 * - Log levels (ERROR, WARN, INFO, DEBUG)
 * - Structured logging (key-value metadata)
 * - Correlation IDs (trace requests)
 * - Configurable outputs (console, remote, devnull)
 * - Performance markers
 * - Module-based prefixes
 *
 * @example
 * ```typescript
 * import { createModuleLogger } from '@/lib/telemetry';
 *
 * const logger = createModuleLogger('FILE_RECORD');
 * logger.info('Creating record', { entityId });
 * logger.warn('Validation warning', { field, value });
 * logger.error('Operation failed', { error });
 * ```
 *
 * @enterprise Canonical logging pattern - NO DUPLICATES
 * @see Local_Protocol - Centralization First
 */

// ============================================================================
// CORE TYPES + OUTPUTS (extracted for Google SRP 500-line limit)
// ============================================================================
import { LogLevel } from './log-types';
import type { LogEntry, LogOutput } from './log-types';
import { ConsoleOutput, CompositeOutput } from './log-outputs';

// Re-export core types + concrete outputs so existing deep imports
// (`@/lib/telemetry/Logger`) keep resolving after the split.
export { LogLevel } from './log-types';
export type { LogEntry, LogOutput } from './log-types';
export { ConsoleOutput, DevNullOutput, CompositeOutput } from './log-outputs';

// ============================================================================
// ERROR NORMALIZATION
// ============================================================================

/**
 * Replaces any `Error` instance found at the top level of a metadata object
 * with `{ message, stack, name }` — ordinary `Error` objects serialize to
 * `{}` via JSON.stringify because their own props are non-enumerable, which
 * hides the actual failure reason from logs.
 *
 * Non-recursive by design: the common bug is `logger.error('msg', { error })`
 * with the Error at depth 1. Deeper nesting is a code smell we don't paper
 * over.
 */
function normalizeNestedErrors(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  let replaced: Record<string, unknown> | null = null;
  for (const key of Object.keys(meta)) {
    const value = meta[key];
    if (value instanceof Error) {
      if (!replaced) replaced = { ...meta };
      replaced[key] = {
        message: value.message,
        name: value.name,
        stack: value.stack,
      };
    }
  }
  return replaced ?? meta;
}

// ============================================================================
// GLOBAL OUTPUT REGISTRY (for server-side outputs like Telegram alerts)
// ============================================================================

const registeredOutputs: LogOutput[] = [];
let alertOutputRegistered = false;

/**
 * Register an additional LogOutput to be attached to all future module loggers.
 */
export function registerLogOutput(output: LogOutput): void {
  registeredOutputs.push(output);
}

/**
 * Lazy one-time registration of Telegram alert output.
 * Runs only on server-side, only in production, only once.
 * Dynamic import keeps Logger.ts isomorphic — bundler includes
 * telegram-alert-service as a separate async chunk.
 */
function ensureTelegramAlertRegistered(): void {
  if (alertOutputRegistered) return;
  if (typeof window !== 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;

  alertOutputRegistered = true;

  import('./telegram-alert-service')
    .then(({ sendTelegramAlert }) => {
      registerLogOutput({
        write(entry: LogEntry) {
          if (entry.level !== LogLevel.ERROR) return;
          try {
            const moduleMatch = entry.message.match(/^\[([^\]]+)\]/);
            const mod = moduleMatch ? moduleMatch[1] : 'Unknown';
            const msg = moduleMatch
              ? entry.message.substring(moduleMatch[0].length).trim()
              : entry.message;
            void sendTelegramAlert(
              'error', mod, msg,
              entry.metadata as Record<string, string> | undefined
            );
          } catch { /* alerting must never break the logger */ }
        }
      });
    })
    .catch(() => { /* swallow — service unavailable */ });
}

// ============================================================================
// LOGGER CLASS
// ============================================================================

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private output: LogOutput;
  private correlationId?: string;

  constructor(
    options: {
      level?: LogLevel;
      prefix?: string;
      output?: LogOutput;
      correlationId?: string;
    } = {}
  ) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '[App]';
    this.output = options.output ?? new ConsoleOutput();
    this.correlationId = options.correlationId;
  }

  // ==========================================================================
  // PUBLIC API - LOG METHODS
  // ==========================================================================

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, this.normalizeMetadata(args));
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, this.normalizeMetadata(args));
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, this.normalizeMetadata(args));
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, this.normalizeMetadata(args));
  }

  // ==========================================================================
  // PUBLIC API - UTILITIES
  // ==========================================================================

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set correlation ID for all future logs
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Create child logger with new prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: `${this.prefix} ${prefix}`,
      output: this.output,
      correlationId: this.correlationId
    });
  }

  /**
   * Start performance timer
   */
  startTimer(label: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} took ${duration.toFixed(2)}ms`);
    };
  }

  // ==========================================================================
  // PRIVATE
  // ==========================================================================

  /**
   * Normalize variadic arguments into a single Record<string, unknown> metadata object.
   *
   * Supports:
   * - No args → undefined
   * - Single Record<string, unknown> → pass through
   * - Single Error → { error: message, stack }
   * - Single primitive → { value: ... }
   * - Multiple args → { arg0, arg1, ... }
   */
  private normalizeMetadata(args: unknown[]): Record<string, unknown> | undefined {
    if (args.length === 0) return undefined;

    if (args.length === 1) {
      const single = args[0];
      if (single === undefined || single === null) return undefined;

      // Already a plain object (most common case)
      if (
        typeof single === 'object' &&
        !Array.isArray(single) &&
        !(single instanceof Error)
      ) {
        // 🏢 Normalize nested Error values so their message/stack survive
        // JSON serialization (Error's own props are non-enumerable).
        return normalizeNestedErrors(single as Record<string, unknown>);
      }

      // Error objects → structured metadata
      if (single instanceof Error) {
        return { error: single.message, stack: single.stack };
      }

      // Primitives or arrays → wrap
      return { value: single };
    }

    // Multiple args → numbered keys
    const result: Record<string, unknown> = {};
    args.forEach((arg, index) => {
      result[`arg${index}`] = arg;
    });
    return normalizeNestedErrors(result);
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    // Skip if below current log level
    if (level > this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message: `${this.prefix} ${message}`,
      timestamp: Date.now(),
      correlationId: this.correlationId,
      metadata
    };

    this.output.write(entry);
  }
}

// ============================================================================
// GLOBAL LOGGER INSTANCE
// ============================================================================
let globalLogger: Logger | null = null;

/**
 * Get global logger instance
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({
      level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG
    });
  }
  return globalLogger;
}

/**
 * Set global logger instance
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Create logger with correlation ID
 */
export function createLogger(correlationId?: string): Logger {
  return new Logger({ correlationId });
}

// ============================================================================
// MODULE LOGGER FACTORY (for services)
// ============================================================================

/**
 * Create a logger instance for a specific module
 *
 * @param moduleName - Module name prefix for log messages (e.g., 'FILE_RECORD', 'PHOTO_UPLOAD')
 * @param level - Minimum log level (default: INFO in production, DEBUG in dev)
 * @returns Logger instance with module prefix
 *
 * @example
 * ```typescript
 * const logger = createModuleLogger('AUTH_SERVICE');
 * logger.info('User authenticated', { userId: '123' });
 * ```
 */
export function createModuleLogger(moduleName: string, level?: LogLevel): Logger {
  // Level resolution (highest priority → lowest):
  //   1. explicit `level` argument (a module that pins its own verbosity)
  //   2. localStorage 'LOG_LEVEL'  — BROWSER RUNTIME override, no rebuild needed
  //      (e.g. `localStorage.setItem('LOG_LEVEL','debug')` then refresh; remove to reset).
  //      Mirrors Firebase `setLogLevel` / the `debug` npm package's `localStorage.debug`.
  //   3. NEXT_PUBLIC_LOG_LEVEL      — build-time env (CI / team-wide default)
  //   4. default: BROWSER → WARN (clean user console — only warnings/errors surface,
  //      Revit/Google/VS-Code-grade), SERVER → INFO (production observability: business
  //      and lifecycle events still reach server logs/telemetry). DEBUG is ALWAYS opt-in.
  //      Dial verbosity per-side: localStorage 'LOG_LEVEL' (browser) or env (both).
  const fromRuntime = resolveRuntimeLogLevel();
  const fromEnv = parseLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
  const isBrowser = typeof window !== 'undefined';
  const defaultLevel = isBrowser ? LogLevel.WARN : LogLevel.INFO;

  // Lazy-register Telegram alerts (one-time, server-side, production only)
  ensureTelegramAlertRegistered();

  // Build output: ConsoleOutput + any registered outputs (e.g., Telegram alerts)
  const output = registeredOutputs.length > 0
    ? new CompositeOutput([new ConsoleOutput(), ...registeredOutputs])
    : new ConsoleOutput();

  return new Logger({
    prefix: `[${moduleName}]`,
    level: level ?? fromRuntime ?? fromEnv ?? defaultLevel,
    output,
  });
}

/**
 * Parse a string log level ('debug'|'info'|'warn'|'error', case-insensitive) into a
 * `LogLevel`. SSoT for level string→enum parsing (env + localStorage share it).
 * Returns null for empty/unknown input so callers can fall through to the next source.
 */
function parseLogLevel(raw: string | null | undefined): LogLevel | null {
  switch ((raw || '').toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    default: return null;
  }
}

/**
 * Browser-only runtime log-level override read from `localStorage['LOG_LEVEL']`.
 * Lets a developer dial verbosity up/down live (refresh re-reads it) without an env
 * change or rebuild. Server-side (no `window`) or unavailable storage → null.
 */
function resolveRuntimeLogLevel(): LogLevel | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseLogLevel(window.localStorage.getItem('LOG_LEVEL'));
  } catch {
    return null;
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default Logger;
