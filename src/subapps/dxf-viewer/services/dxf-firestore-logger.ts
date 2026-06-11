import { createModuleLogger } from '../settings/telemetry/Logger';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

/**
 * DxfFirestore logger — routed through the `createModuleLogger` SSoT (ADR-036) so it
 * honours the side-aware default (browser → WARN, server → INFO), the `localStorage`
 * 'LOG_LEVEL' runtime override, and `NEXT_PUBLIC_LOG_LEVEL`.
 *
 * Was a hand-rolled `new Logger({ level: dev ? DEBUG : ERROR })` that bypassed ALL of the
 * above and unconditionally flooded the dev browser console with `[DEBUG] [DxfFirestore]`
 * (scene load/save traces) — the noise that survived the global level change.
 *
 * @enterprise ADR-036 — Centralized Logging System
 */
export const dxfLogger = createModuleLogger('DxfFirestore');

/**
 * Error classification for intelligent logging
 * @enterprise Pattern: Error categorization for appropriate log levels
 */
export const isExpectedError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  // These are expected scenarios (file doesn't exist, no permission for missing doc)
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('does not exist') ||
    (message.includes('permission') && message.includes('missing'))
  );
};
