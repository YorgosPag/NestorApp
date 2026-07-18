/**
 * @fileoverview Unified Grip Rendering System - Centralized Constants
 * @description Single source of truth for all grip rendering constants
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO magic numbers
 */

import { GRIP_COLD_COLOR, GRIP_WARM_COLOR, GRIP_HOT_COLOR, GRIP_CONTOUR_COLOR, GRIP_SNAPPABLE_COLOR, GRIP_ARMED_COLOR } from '../../config/color-config';

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
  ARMED: 1.25, // ADR-501 — armed/selected (multi-grip), +25% like warm for visibility
} as const;

/**
 * Edge grip size multipliers based on temperature state
 * Edge grips use slightly larger multipliers than vertex grips
 * for more dramatic hover/active feedback on thin edge lines
 *
 * 🏢 ADR-106: Centralized Edge Grip Size Multipliers
 *
 * - COLD (1.0x): Normal state, default size
 * - WARM (1.4x): Hover state, 40% larger (vs 25% for vertex)
 * - HOT (1.6x): Active/drag state, 60% larger (vs 50% for vertex)
 */
export const EDGE_GRIP_SIZE_MULTIPLIERS = {
  COLD: 1.0,   // Normal state
  WARM: 1.4,   // Hover state (+40%)
  HOT: 1.6,    // Active/drag state (+60%)
  ARMED: 1.4,  // ADR-501 — armed/selected (multi-grip), matches warm edge emphasis
} as const;

// ============================================================================
// DEFAULT GRIP COLORS (AutoCAD Standard)
// ============================================================================

/**
 * Default grip colors following AutoCAD ACI (AutoCAD Color Index) standards
 * Can be overridden by GripSettings from user preferences
 *
 * - COLD: Blue (ACI 5) - Standard unselected grip
 * - WARM: Magenta/ροζ - Hover feedback (Giorgio 2026-07-07, was orange)
 * - HOT: Red (ACI 1) - Active/selected grip
 * - CONTOUR: Black - Grip outline
 */
export const DEFAULT_GRIP_COLORS = {
  COLD: GRIP_COLD_COLOR,  // SSOT → color-config.ts (σιελ)
  WARM: GRIP_WARM_COLOR,  // SSOT → color-config.ts (magenta/ροζ, hover) — auto-flips with the constant
  HOT: GRIP_HOT_COLOR,    // SSOT → color-config.ts (red, active drag) — was hardcoded
  ARMED: GRIP_ARMED_COLOR, // ADR-501 — orange, armed/selected (multi-grip)
  SNAPPABLE: GRIP_SNAPPABLE_COLOR, // Cyan — snap target during rotation (ADR-397)
  CONTOUR: GRIP_CONTOUR_COLOR, // SSOT → color-config.ts (black outline) — was hardcoded
} as const;

// ============================================================================
// GRIP TYPE-SPECIFIC CONSTANTS
// ============================================================================

/**
 * Midpoint grip size reduction factor
 * Midpoint grips render at 75% of vertex grip size for visual hierarchy
 */
export const MIDPOINT_SIZE_FACTOR = 0.75;

// REMOVED: EDGE_GRIP_COLOR (green for cold edge grips).
// Colour encodes grip STATE, never grip TYPE — type is carried by `GripShape`.
// The old comment claimed "(AutoCAD standard)"; it was the opposite: in AutoCAD
// green means HOVER, so a green resting grip read as "you are on it". See the
// ADR-048 changelog entry. Do not reintroduce.

/**
 * Minimum grip size (pixels)
 * Ensures grips remain visible even at small DPI scales
 */
export const MIN_GRIP_SIZE = 3;

/**
 * Maximum grip size (pixels)
 * Prevents grips from becoming too large at high DPI scales
 */
export const MAX_GRIP_SIZE = 30;
