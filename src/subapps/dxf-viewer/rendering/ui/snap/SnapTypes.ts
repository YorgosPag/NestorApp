/**
 * SNAP TYPES - Centralized types για snap indicator rendering
 * ✅ ΦΑΣΗ 6: Unified snap interfaces
 */

import type { Point2D } from '../../types/Types';
import type { UIElementSettings } from '../core/UIRenderer';
// 🏢 ADR-134: Centralized Opacity Constants
import { UI_COLORS, OPACITY } from '../../../config/color-config';
// 🏢 ADR-095: Centralized Snap Tolerance
// 🏢 ADR-153: Centralized Snap Tooltip Offset
import { SNAP_TOLERANCE, SNAP_TOOLTIP_OFFSET } from '../../../config/tolerance-config';

/**
 * 🔺 SNAP TYPES
 * Different types of snap points
 */
export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'center'
  | 'intersection'
  | 'perpendicular'
  | 'parallel'
  | 'tangent'
  | 'quadrant'
  | 'nearest'
  | 'grid';

/**
 * 🔺 SNAP RESULT
 * Represents a detected snap point
 */
export interface SnapResult {
  readonly point: Point2D;
  readonly type: SnapType;
  readonly distance: number;
  readonly entityId?: string;    // Optional reference to snapped entity
  readonly priority: number;     // Higher = more important
}

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

  // Type-specific colors
  readonly endpointColor: string;
  readonly midpointColor: string;
  readonly centerColor: string;
  readonly intersectionColor: string;

  // Visual feedback
  readonly showTooltip: boolean;
  readonly tooltipOffset: number;
  readonly highlightColor: string;
}

/**
 * 🔺 SNAP RENDER DATA
 * Data που χρειάζεται το SnapRenderer
 */
export interface SnapRenderData {
  readonly snapResults: SnapResult[];
  readonly settings: SnapSettings;
  readonly activeSnap?: SnapResult;  // Currently active snap
  readonly timestamp?: number;       // For animations
}

/**
 * 🔺 SNAP RENDER MODES
 * Different rendering approaches
 */
export type SnapRenderMode =
  | 'normal'      // Standard snap indicators
  | 'highlight'   // Emphasized snap (brighter/larger)
  | 'preview';    // Preview mode with tooltips

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

  // Type-specific colors
  endpointColor: UI_COLORS.SNAP_ENDPOINT,   // Red for endpoints
  midpointColor: UI_COLORS.SNAP_MIDPOINT,   // Green for midpoints
  centerColor: UI_COLORS.SNAP_CENTER,     // Blue for centers
  intersectionColor: UI_COLORS.SNAP_INTERSECTION, // Magenta for intersections

  // Visual feedback
  showTooltip: true,
  tooltipOffset: SNAP_TOOLTIP_OFFSET,  // 🏢 ADR-153: Centralized snap tooltip offset
  highlightColor: UI_COLORS.SNAP_HIGHLIGHT,
  zIndex: 950                 // Very high priority for snap visibility
};