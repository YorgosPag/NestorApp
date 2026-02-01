/**
 * Hover Configuration
 * Centralized configuration for consistent hover behavior styling
 */

import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-083: Centralized Line Dash Patterns
// 🏢 ADR-090: Centralized UI Fonts
import { LINE_DASH_PATTERNS, UI_FONTS } from '../../config/text-rendering-config';

// ============================================================================
// 🏢 ENTERPRISE: Overlay Dimension Constants (ADR-138)
// Single source of truth for all UI overlay sizes
// ============================================================================

/**
 * Centralized overlay dimension constants
 * Eliminates magic numbers and ensures consistency across the codebase
 *
 * @see ADR-138: Overlay Dimensions Centralization
 * @see OverlayPass.ts - Uses CROSSHAIR and MOVE_ARROW
 * @see SnapIndicatorOverlay.tsx - Uses SNAP_INDICATOR (via SNAP_ICON_GEOMETRY)
 */
export const OVERLAY_DIMENSIONS = {
  /** Snap indicator marker size (pixels) - CAD standard */
  SNAP_INDICATOR: 12,

  /** Crosshair cursor size (pixels) - extends from center in each direction */
  CROSSHAIR: 20,

  /** Minimum marquee selection size (pixels) - prevents accidental tiny selections */
  MIN_MARQUEE: 5,

  /** Arrow indicator size for move cursor (pixels) - 4-way arrow indicator */
  MOVE_ARROW: 8,

  /** Snap crosshair size in OverlayPass (pixels) - smaller than main crosshair */
  SNAP_CROSSHAIR: 8,

  /** Arrow head size for directional indicators (pixels) - ghost entities, dimension lines */
  // 🏢 ADR-150: Centralized arrow/marker size for visual consistency
  ARROW_HEAD: 8,
} as const;

export interface HoverConfig {
  colors: {
    distance: string;
    angle: string;
    area: string;
  };
  fonts: {
    distance: string;
    angle: string;
    area: string;
  };
  offsets: {
    gripAvoidance: number;
    arcRadius: number;
    textFromArc: number;
  };
  lineStyle: {
    dashPattern: number[];
  };
}

// Configuration based on existing polyline styling
export const HOVER_CONFIG: HoverConfig = {
  colors: {
    distance: UI_COLORS.MEASUREMENT_TEXT,  // Green - from existing distance labels
    angle: UI_COLORS.DEBUG_DISTANCE,     // Orange - from existing angle arcs
    area: UI_COLORS.BRIGHT_GREEN       // Bright green - from existing area labels
  },
  fonts: {
    distance: UI_FONTS.ARIAL.SMALL, // 🏢 ADR-090: Centralized font
    angle: UI_FONTS.ARIAL.SMALL,    // 🏢 ADR-090: Centralized font
    area: UI_FONTS.ARIAL.LARGE      // 🏢 ADR-090: Centralized font
  },
  offsets: {
    gripAvoidance: 20,    // From LineRenderer
    arcRadius: 30,        // From PolylineRenderer
    textFromArc: 20       // From PolylineRenderer
  },
  lineStyle: {
    // 🏢 ADR-083: Use centralized line dash pattern
    dashPattern: [...LINE_DASH_PATTERNS.SELECTION]
  }
};