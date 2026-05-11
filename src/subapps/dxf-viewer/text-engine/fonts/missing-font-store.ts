/**
 * MissingFontStore — singleton store for the current DXF file's missing-font report
 * (ADR-344 Phase 2, Q20).
 *
 * Follows the HoverStore / ImmediateSnapStore pattern (ADR-040): module-level
 * mutable state + subscriber set, consumed via useSyncExternalStore in leaf
 * components. Low-frequency updates (once per DXF file open) — no React state.
 *
 * @module text-engine/fonts/missing-font-store
 */

import type { MissingFontReport } from './font-loader';

export type { MissingFontReport };

type Listener = () => void;

// ─── Internal mutable state ───────────────────────────────────────────────────

let currentReport: MissingFontReport | null = null;
const subscribers = new Set<Listener>();

// ─── Mutation API ─────────────────────────────────────────────────────────────

/** Called by FontLoader after a DXF file opens. Notifies all subscribers. */
export function setMissingFontReport(report: MissingFontReport | null): void {
  currentReport = report;
  subscribers.forEach((cb) => cb());
}

/** Called when the user dismisses the banner or opens a new file. */
export function clearMissingFontReport(): void {
  setMissingFontReport(null);
}

// ─── useSyncExternalStore interface ──────────────────────────────────────────

export function subscribeMissingFontReport(listener: Listener): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getMissingFontReport(): MissingFontReport | null {
  return currentReport;
}
