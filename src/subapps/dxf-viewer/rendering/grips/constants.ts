/**
 * @fileoverview Unified Grip Rendering System - Centralized Constants
 * @description Single source of truth for all grip rendering constants
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO magic numbers
 */

import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// GRIP SIZE MULTIPLIERS (AutoCAD/BricsCAD Standards)
// ============================================================================

/**
 * Grip size multipliers based on temperature state
 * Following AutoCAD standard visual feedback patterns
 *
 * - COLD (1.0x): Normal state, default size
 * - WARM (1.25x): Hover state, 25% larger for visibility
 * - HOT (1.5x): Active/drag state, 50% larger for emphasis
 */
export const GRIP_SIZE_MULTIPLIERS = {
  COLD: 1.0,   // Normal state
  WARM: 1.25,  // Hover state (+25%)
  HOT: 1.5,    // Active/drag state (+50%)
} as const;

// ============================================================================
// DEFAULT GRIP COLORS (AutoCAD Standard)
// ============================================================================

/**
 * Default grip colors following AutoCAD ACI (AutoCAD Color Index) standards
 * Can be overridden by GripSettings from user preferences
 *
 * - COLD: Blue (ACI 5) - Standard unselected grip
 * - WARM: Orange - Hover feedback
 * - HOT: Red (ACI 1) - Active/selected grip
 * - CONTOUR: Black - Grip outline
 */
export const DEFAULT_GRIP_COLORS = {
  COLD: '#5F9ED1',   // Blue (AutoCAD ACI 5)
  WARM: '#FF7F00',   // Orange (hover feedback)
  HOT: '#FF0000',    // Red (AutoCAD ACI 1)
  CONTOUR: '#000000', // Black outline
} as const;

// ============================================================================
// GRIP TYPE-SPECIFIC CONSTANTS
// ============================================================================

/**
 * Midpoint grip size reduction factor
 * Midpoint grips render at 75% of vertex grip size for visual hierarchy
 */
export const MIDPOINT_SIZE_FACTOR = 0.75;

/**
 * Edge grip cold color (special case)
 * Edge grips when cold (not hovered) use green color for distinction
 * Following existing GripPhaseRenderer pattern
 */
export const EDGE_GRIP_COLOR = UI_COLORS.SUCCESS_BRIGHT; // Green

/**
 * Minimum grip size (pixels)
 * Ensures grips remain visible even at small DPI scales
 */
export const MIN_GRIP_SIZE = 3;

/**
 * Maximum grip size (pixels)
 * Prevents grips from becoming too large at high DPI scales
 */
export const MAX_GRIP_SIZE = 20;
