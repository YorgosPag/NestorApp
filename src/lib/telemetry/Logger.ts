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
// LOG LEVELS
// ============================================================================

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// ============================================================================
// LOG ENTRY
// ============================================================================

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// LOG OUTPUT INTERFACE
// ============================================================================

export interface LogOutput {
  write(entry: LogEntry): void;
}

// ============================================================================
// CONSOLE OUTPUT
// ============================================================================

export class ConsoleOutput implements LogOutput {
  write(entry: LogEntry): void {
    const prefix = `[${LogLevel[entry.level]}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    const correlationId = entry.correlationId ? ` [${entry.correlationId}]` : '';

    const message = `${timestamp}${correlationId} ${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.metadata || '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata || '');
        break;
      case LogLevel.INFO:
        console.info(message, entry.metadata || '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata || '');
        break;
    }
  }
}

// ============================================================================
// DEVNULL OUTPUT (SILENT)
// ============================================================================

export class DevNullOutput implements LogOutput {
  write(_entry: LogEntry): void {
    // Do nothing (silent)
  }
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
        return single as Record<string, unknown>;
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
    return result;
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
  const defaultLevel = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  return new Logger({
    prefix: `[${moduleName}]`,
    level: level ?? defaultLevel
  });
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default Logger;
