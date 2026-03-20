/**
 * =============================================================================
 * TELEGRAM ALERT OUTPUT — Server-only LogOutput
 * =============================================================================
 *
 * LogOutput implementation that sends ERROR-level logs as Telegram alerts.
 * This file is server-only — it is imported exclusively by instrumentation.ts
 * and never touches client bundles.
 *
 * @module lib/telemetry/telegram-alert-output
 * @enterprise Production Error Monitoring
 */

import 'server-only';

import type { LogEntry, LogOutput } from './Logger';
import { LogLevel } from './Logger';
import { sendTelegramAlert } from './telegram-alert-service';

/**
 * LogOutput that sends ERROR-level logs as Telegram alerts to the Super Admin.
 * Fire-and-forget — never blocks the logger, never throws.
 */
export class TelegramAlertOutput implements LogOutput {
  write(entry: LogEntry): void {
    if (entry.level !== LogLevel.ERROR) return;

    try {
      // Extract module name from prefix (e.g., "[MyModule]" → "MyModule")
      const moduleMatch = entry.message.match(/^\[([^\]]+)\]/);
      const module = moduleMatch ? moduleMatch[1] : 'Unknown';
      const message = moduleMatch
        ? entry.message.substring(moduleMatch[0].length).trim()
        : entry.message;

      const metadata = entry.metadata as Record<string, string> | undefined;

      // Fire-and-forget — NEVER await, NEVER block
      void sendTelegramAlert('error', module, message, metadata);
    } catch {
      // Swallow — alerting must NEVER break the logger
    }
  }
}
