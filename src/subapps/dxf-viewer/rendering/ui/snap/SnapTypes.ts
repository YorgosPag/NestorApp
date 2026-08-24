/**
 * SNAP TYPES - Centralized types για snap indicator rendering
 * ✅ ΦΑΣΗ 6: Unified snap interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';

// ADR-137 §Step 2 — the legacy `SnapType` / `SnapResult` / `SnapRenderData` / `SnapRenderMode`
// vocabularies were removed (only the deleted canvas `SnapRenderer`/`LegacySnapAdapter` used them).
// The single snap result SSoT is `ProSnapResult`/`SnapCandidate` in `snapping/extended-types.ts`;
// the overlay view-model is `SnapIndicatorView` there. This file now owns ONLY the snap *settings*
// (`SnapSettings` — μόνο ο ΤΥΠΟΣ), consumed by `CanvasSettings`.

/**
 * 🔺 SNAP SETTINGS
 * Centralized interface για snap configuration
 * Extends UIElementSettings για consistency
 */
export interface SnapSettings extends UIElementSettings {
  readonly color: string;
  readonly size: number;           // Size in pixels
  readonly lineWidth: number;
  readonly tolerance: number;      // Snap tolerance in pixels

  // ADR-515: τα type-specific color fields αφαιρέθηκαν (νεκρά — κανείς renderer δεν τα
  // διάβαζε). Το type→χρώμα SSoT είναι `SNAP_COLORS`/`resolveSnapColor` στο snap-visual-config.

  // Visual feedback
  readonly showTooltip: boolean;
  readonly tooltipOffset: number;
  readonly highlightColor: string;
}


// ADR-700 §4 (2026-08-24): DEFAULT_SNAP_SETTINGS ΔΙΑΓΡΑΦΗΚΕ — μηδέν καταναλωτές. Το σχόλιο
// παραπάνω έλεγε «still consumed by CanvasSettings», αλλά το `CanvasSettings.ts:22` εισάγει
// **μόνο τον τύπο** `SnapSettings`, ποτέ τις τιμές. Οι δύο μοναδικές αναφορές του ήταν
// re-exports σε barrels χωρίς κανέναν δικό τους καταναλωτή.
