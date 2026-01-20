/**
 * =============================================================================
 * BACKWARD-COMPATIBLE ALIAS
 * =============================================================================
 *
 * @deprecated Use '@/lib/telemetry' instead
 *
 * This file re-exports from the canonical app-wide logger location.
 * Kept for backward compatibility with existing DXF viewer imports.
 *
 * @enterprise NO DUPLICATES - Single canonical source
 * @see src/lib/telemetry/Logger.ts (canonical)
 */

// Re-export everything from canonical location
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
} from '@/lib/telemetry';

export { default } from '@/lib/telemetry';
