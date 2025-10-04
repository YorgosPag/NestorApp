/**
 * SNAP TYPES - Centralized types για snap indicator rendering
 * ✅ ΦΑΣΗ 6: Unified snap interfaces
 */

import type { Point2D } from '../../types/Types';
import type { UIElementSettings } from '../core/UIRenderer';

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
  opacity: 0.9,
  color: '#ffff00',           // Yellow default
  size: 8,
  lineWidth: 2,
  tolerance: 10,              // 10px snap tolerance

  // Type-specific colors
  endpointColor: '#ff0000',   // Red for endpoints
  midpointColor: '#00ff00',   // Green for midpoints
  centerColor: '#0000ff',     // Blue for centers
  intersectionColor: '#ff00ff', // Magenta for intersections

  // Visual feedback
  showTooltip: true,
  tooltipOffset: 15,
  highlightColor: '#ffffff',
  zIndex: 950                 // Very high priority for snap visibility
};