/**
 * @file Telemetry Module Exports
 * @module settings/telemetry
 *
 * ENTERPRISE STANDARD - Public API for observability
 */

/**
 * @deprecated Use '@/lib/telemetry' instead
 * Re-exports from canonical location for backward compatibility
 */
export {
  Logger,
  LogLevel,
  ConsoleOutput,
  DevNullOutput,
  getLogger,
  setLogger,
  createLogger,
  createModuleLogger,
  type LogEntry,
  type LogOutput,
} from './Logger';

export {
  Metrics,
  getMetrics,
  setMetrics,
  createMetrics
} from './Metrics';
