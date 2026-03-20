/**
 * =============================================================================
 * NEXT.JS INSTRUMENTATION — Server-side initialization
 * =============================================================================
 *
 * Runs once at server startup (Node.js runtime only).
 * Registers server-side LogOutputs (Telegram alerts) with the canonical Logger.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @enterprise Production Error Monitoring
 */

export async function register(): Promise<void> {
  // Only register on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerLogOutput } = await import('@/lib/telemetry/Logger');
    const { TelegramAlertOutput } = await import('@/lib/telemetry/telegram-alert-output');

    registerLogOutput(new TelegramAlertOutput());
  }
}
