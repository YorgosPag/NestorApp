/**
 * @file Structured Logger
 * @module settings/telemetry/Logger
 *
 * ENTERPRISE STANDARD - Production-grade logging
 *
 * **FEATURES:**
 * - Log levels (ERROR, WARN, INFO, DEBUG)
 * - Structured logging (key-value metadata)
 * - Correlation IDs (trace requests)
 * - Configurable outputs (console, remote, devnull)
 * - Performance markers
 *
 *  - Module #7
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
// LOGGER
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
    this.prefix = options.prefix ?? '[DxfSettings]';
    this.output = options.output ?? new ConsoleOutput();
    this.correlationId = options.correlationId;
  }

  // ==========================================================================
  // PUBLIC API - LOG METHODS
  // ==========================================================================

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  // ==========================================================================
  // PUBLIC API - UTILITIES
  // ==========================================================================

  /**
   * Set log level
   *
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   *
   * @returns Current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set correlation ID for all future logs
   *
   * @param correlationId - Correlation ID
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Create child logger with new prefix
   *
   * @param prefix - New prefix
   * @returns Child logger
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
   *
   * @param label - Timer label
   * @returns Stop function
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
 *
 * @returns Global logger
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
 *
 * @param logger - Logger instance
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Create logger with correlation ID
 *
 * @param correlationId - Correlation ID
 * @returns Logger instance
 */
export function createLogger(correlationId?: string): Logger {
  return new Logger({ correlationId });
}
