/**
 * =============================================================================
 * CANONICAL LOGGER — OUTPUT IMPLEMENTATIONS
 * =============================================================================
 *
 * Concrete `LogOutput` sinks: console, devnull (silent), and composite
 * (fan-out). Extracted from `Logger.ts` (Google SRP 500-line limit) and
 * re-exported from there for backward-compatible imports.
 *
 * @module lib/telemetry/log-outputs
 */

import { LogLevel, type LogEntry, type LogOutput } from './log-types';

// ============================================================================
// CONSOLE OUTPUT
// ============================================================================
export class ConsoleOutput implements LogOutput {
  write(entry: LogEntry): void {
    const prefix = `[${LogLevel[entry.level]}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    const correlationId = entry.correlationId ? ` [${entry.correlationId}]` : '';

    const message = `${timestamp}${correlationId} ${prefix} ${entry.message}`;
    const rawMeta = entry.metadata;
    // Use JSON.stringify with a replacer that handles non-serializable values.
    // This avoids the `{}` display bug caused by FirebaseError / FirestoreError
    // having non-enumerable prototype properties.
    const metaStr = rawMeta
      ? JSON.stringify(rawMeta, (_k, v: unknown) => {
          if (v === undefined) return '[undefined]';
          if (typeof v === 'object' && v !== null) {
            const asErr = v as { message?: unknown; code?: unknown; name?: unknown; stack?: unknown };
            if (typeof asErr.message === 'string' || typeof asErr.code === 'string') {
              return { message: asErr.message, code: asErr.code, name: asErr.name };
            }
          }
          return v;
        })
      : '';

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, metaStr || '');
        break;
      case LogLevel.WARN:
        console.warn(message, metaStr || '');
        break;
      case LogLevel.INFO:
        console.info(message, metaStr || '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, metaStr || '');
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
// COMPOSITE OUTPUT (multiple outputs)
// ============================================================================
export class CompositeOutput implements LogOutput {
  private outputs: LogOutput[];

  constructor(outputs: LogOutput[]) {
    this.outputs = outputs;
  }

  write(entry: LogEntry): void {
    for (const output of this.outputs) {
      output.write(entry);
    }
  }
}
