/**
 * =============================================================================
 * CANONICAL TELEMETRY MODULE
 * =============================================================================
 *
 * App-wide canonical logging and telemetry system.
 *
 * @module lib/telemetry
 * @enterprise Canonical - NO DUPLICATES
 *
 * @example
 * ```typescript
 * import { createModuleLogger, LogLevel } from '@/lib/telemetry';
 *
 * const logger = createModuleLogger('MY_SERVICE');
 * logger.info('Operation started');
 * ```
 */

export {
  // Classes
  Logger,
  ConsoleOutput,
  DevNullOutput,
  CompositeOutput,

  // Types & Interfaces
  LogLevel,
  type LogEntry,
  type LogOutput,

  // Factory functions
  createLogger,
  createModuleLogger,
  getLogger,
  setLogger,
} from './Logger';

// ADR-259D: Sentry error capture helpers
export {
  captureException as sentryCaptureException,
  captureMessage as sentryCaptureMessage,
} from './sentry';

// Default export
export { default } from './Logger';
