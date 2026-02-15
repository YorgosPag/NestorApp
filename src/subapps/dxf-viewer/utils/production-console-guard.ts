/**
 * Production Console Guard
 *
 * Silences console.log / console.warn / console.debug in production builds.
 * console.error is PRESERVED — real errors must always surface.
 *
 * This is Layer 1 of the production logging strategy:
 *   Layer 1: Global guard (this file) — immediate blanket silence
 *   Layer 2: Gradual migration of console.* → dlog/dwarn/derr (debug system)
 *
 * @see debug/core/UnifiedDebugManager.ts for the enterprise debug system
 */

const noop = (): void => { /* production silence */ };

/**
 * Install the production console guard.
 * Call once at app entry point (DxfViewerApp.tsx).
 *
 * In development: no-op (all console methods preserved)
 * In production: console.log, console.warn, console.debug silenced
 */
export function installProductionConsoleGuard(): void {
  if (process.env.NODE_ENV === 'production') {
    console.log = noop;
    console.warn = noop;
    console.debug = noop;
    // console.error preserved — real errors must always surface
  }
}
