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

// Default export
export { default } from './Logger';
