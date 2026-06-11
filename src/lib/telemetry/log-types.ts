/**
 * =============================================================================
 * CANONICAL LOGGER — CORE TYPES
 * =============================================================================
 *
 * Log level / entry / output contracts shared by the Logger class and the
 * concrete output implementations. Extracted from `Logger.ts` (Google SRP
 * 500-line limit) and re-exported from there for backward-compatible imports.
 *
 * @module lib/telemetry/log-types
 */

// ============================================================================
// LOG LEVELS
// ============================================================================
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
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
