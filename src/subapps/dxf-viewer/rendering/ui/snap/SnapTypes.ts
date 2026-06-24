/**
 * SNAP TYPES - Centralized types για snap indicator rendering
 * ✅ ΦΑΣΗ 6: Unified snap interfaces
 */

import type { UIElementSettings } from '../core/UIRenderer';
// 🏢 ADR-134: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../../../config/color-config';
// 🏢 ADR-095: Centralized Snap Tolerance
// 🏢 ADR-153: Centralized Snap Tooltip Offset
// 🏢 ADR-034: Centralized Rendering Z-Index
import { SNAP_TOLERANCE, SNAP_TOOLTIP_OFFSET, RENDERING_ZINDEX } from '../../../config/tolerance-config';

// ADR-137 §Step 2 — the legacy `SnapType` / `SnapResult` / `SnapRenderData` / `SnapRenderMode`
// vocabularies were removed (only the deleted canvas `SnapRenderer`/`LegacySnapAdapter` used them).
// The single snap result SSoT is `ProSnapResult`/`SnapCandidate` in `snapping/extended-types.ts`;
// the overlay view-model is `SnapIndicatorView` there. This file now owns ONLY the snap *settings*
// (`SnapSettings` + `DEFAULT_SNAP_SETTINGS`), still consumed by `CanvasSettings`.

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

/**
 * 🔺 DEFAULT SNAP SETTINGS
 * Sensible defaults για snap rendering
 */
export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  enabled: true,
  visible: true,
  opacity: OPACITY.HIGH,  // 🏢 ADR-134: Centralized opacity (0.9)
  color: UI_COLORS.SNAP_DEFAULT,           // Yellow default
  size: 8,
  lineWidth: 2,
  tolerance: SNAP_TOLERANCE,  // 🏢 ADR-095: Centralized snap tolerance

  // Visual feedback
  showTooltip: true,
  tooltipOffset: SNAP_TOOLTIP_OFFSET,  // 🏢 ADR-153: Centralized snap tooltip offset
  highlightColor: UI_COLORS.SNAP_HIGHLIGHT,
  zIndex: RENDERING_ZINDEX.SNAP  // 🏢 ADR-034: Centralized z-index (900)
};