/**
 * 📍 SNAP SYSTEM DEFAULT CONFIGURATION
 *
 * Default settings για snap functionality
 *
 * @module floor-plan-system/snapping/config/snap-defaults
 *
 * Based on:
 * - AutoCAD OSNAP defaults
 * - QGIS snapping settings
 * - FreeCAD snap behavior
 */

import { SnapMode, SnapSettings } from '../types';

/**
 * Default Snap Settings
 *
 * Industry-standard snap configuration
 */
export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  /** Snap enabled by default για control point picking */
  enabled: true,

  /** Snap radius: 10 pixels (AutoCAD standard) */
  radius: 10,

  /** Initially only endpoint snap enabled */
  enabledModes: [SnapMode.ENDPOINT],

  /** Indicator color: Cyan (#00FFFF) - AutoCAD standard */
  indicatorColor: '#00FFFF',

  /** Indicator size: 8px radius (visible but not obtrusive) */
  indicatorSize: 8,

  /** Show tooltip by default */
  showTooltip: true
};

/**
 * Snap Radius Limits
 */
export const SNAP_RADIUS_LIMITS = {
  /** Minimum snap radius (pixels) */
  MIN: 3,
  /** Maximum snap radius (pixels) */
  MAX: 25,
  /** Default snap radius (pixels) */
  DEFAULT: 10
} as const;

/**
 * Visual Constants
 */
export const SNAP_VISUAL = {
  /** Indicator colors by snap mode */
  COLORS: {
    [SnapMode.ENDPOINT]: '#00FFFF',      // Cyan
    [SnapMode.MIDPOINT]: '#00FF00',      // Green
    [SnapMode.CENTER]: '#FF00FF',        // Magenta
    [SnapMode.INTERSECTION]: '#FFFF00',  // Yellow
    [SnapMode.NEAREST]: '#FFA500',       // Orange
    [SnapMode.PERPENDICULAR]: '#FF0000'  // Red
  },

  /** Indicator sizes (radius in pixels) */
  SIZES: {
    NORMAL: 8,
    HOVER: 10,
    ACTIVE: 12
  },

  /** Animation durations (ms) */
  ANIMATION: {
    SNAP_DURATION: 150,
    FADE_IN: 100,
    FADE_OUT: 100
  },

  /** Z-index for snap overlay */
  Z_INDEX: 999
} as const;

/**
 * Snap Mode Labels (για tooltips)
 */
export const SNAP_MODE_LABELS: Record<SnapMode, string> = {
  [SnapMode.ENDPOINT]: 'Endpoint',
  [SnapMode.MIDPOINT]: 'Midpoint',
  [SnapMode.CENTER]: 'Center',
  [SnapMode.INTERSECTION]: 'Intersection',
  [SnapMode.NEAREST]: 'Nearest',
  [SnapMode.PERPENDICULAR]: 'Perpendicular'
};

/**
 * Snap Mode Priorities
 *
 * When multiple snap points overlap, use this priority order
 */
export const SNAP_MODE_PRIORITY: Record<SnapMode, number> = {
  [SnapMode.ENDPOINT]: 10,      // Highest priority
  [SnapMode.INTERSECTION]: 9,
  [SnapMode.CENTER]: 8,
  [SnapMode.MIDPOINT]: 7,
  [SnapMode.PERPENDICULAR]: 6,
  [SnapMode.NEAREST]: 5         // Lowest priority
};
