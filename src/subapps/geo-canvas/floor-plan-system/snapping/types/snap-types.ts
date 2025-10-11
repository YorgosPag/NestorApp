/**
 * 📍 SNAP SYSTEM TYPE DEFINITIONS
 *
 * Core type definitions for snap-to-point functionality
 *
 * @module floor-plan-system/snapping/types/snap-types
 *
 * Features:
 * - SnapPoint: Geometric point that can be snapped to
 * - SnapMode: Types of snap (Endpoint, Midpoint, Center, etc.)
 * - SnapResult: Result of snap calculation
 * - SnapSettings: User-configurable snap settings
 */

/**
 * Snap Mode Enum
 *
 * Defines types of snap points (similar to AutoCAD OSNAP)
 */
export enum SnapMode {
  /** Snap to line/arc endpoints */
  ENDPOINT = 'endpoint',
  /** Snap to line midpoints */
  MIDPOINT = 'midpoint',
  /** Snap to circle/arc centers */
  CENTER = 'center',
  /** Snap to line intersections */
  INTERSECTION = 'intersection',
  /** Snap to nearest point on entity */
  NEAREST = 'nearest',
  /** Snap perpendicular to line */
  PERPENDICULAR = 'perpendicular'
}

/**
 * Snap Point Interface
 *
 * Represents a geometric point that can be snapped to
 */
export interface SnapPoint {
  /** X coordinate in floor plan space */
  x: number;
  /** Y coordinate in floor plan space */
  y: number;
  /** Type of snap point */
  mode: SnapMode;
  /** Optional entity ID this point belongs to */
  entityId?: string;
  /** Optional entity type (LINE, CIRCLE, ARC, etc.) */
  entityType?: string;
  /** Optional label for tooltip */
  label?: string;
}

/**
 * Snap Result Interface
 *
 * Result of snap calculation - nearest point within snap radius
 */
export interface SnapResult {
  /** Snapped point */
  point: SnapPoint;
  /** Distance from cursor to snap point (pixels) */
  distance: number;
  /** Is this snap active? */
  isActive: boolean;
}

/**
 * Snap Settings Interface
 *
 * User-configurable snap settings
 */
export interface SnapSettings {
  /** Is snap enabled? */
  enabled: boolean;
  /** Snap radius in pixels (cursor must be within this distance) */
  radius: number;
  /** Which snap modes are enabled */
  enabledModes: SnapMode[];
  /** Visual indicator color */
  indicatorColor: string;
  /** Indicator size (radius in pixels) */
  indicatorSize: number;
  /** Show tooltip with coordinates? */
  showTooltip: boolean;
}

/**
 * Snap Point Collection Interface
 *
 * Collection of all snap points extracted from DXF
 */
export interface SnapPointCollection {
  /** All snap points */
  points: SnapPoint[];
  /** Points grouped by mode */
  byMode: Record<SnapMode, SnapPoint[]>;
  /** Points grouped by entity ID */
  byEntity: Record<string, SnapPoint[]>;
}
