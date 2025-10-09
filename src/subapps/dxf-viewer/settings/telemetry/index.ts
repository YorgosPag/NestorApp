/**
 * @file Telemetry Module Exports
 * @module settings/telemetry
 *
 * ENTERPRISE STANDARD - Public API for observability
 */

export {
  Logger,
  LogLevel,
  ConsoleOutput,
  DevNullOutput,
  getLogger,
  setLogger,
  createLogger
} from './Logger';

export type { LogEntry, LogOutput } from './Logger';

export {
  Metrics,
  getMetrics,
  setMetrics,
  createMetrics
} from './Metrics';
