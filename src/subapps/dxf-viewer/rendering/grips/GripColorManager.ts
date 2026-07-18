/**
 * @fileoverview Grip Color Manager - Centralized Color Mapping
 * @description Maps temperature/type to fill colors with priority system
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO hardcoded colors
 */

import type { GripTemperature, GripSettings } from './types';
import { DEFAULT_GRIP_COLORS } from './constants';

// ============================================================================
// GRIP COLOR MANAGER CLASS
// ============================================================================

/**
 * Enterprise Grip Color Manager
 * Centralized color selection with priority system:
 * 1. Custom color override (ADR-047)
 * 2. Temperature-based color from settings
 * 3. Default temperature color
 *
 * ⚠️ COLOUR ENCODES **STATE ONLY** — never grip type.
 * The grip's *type* (vertex / edge-midpoint / corner / …) is carried by its
 * **shape** (`GripShape`: square vs diamond vs move/rotation glyph), exactly as
 * AutoCAD / Revit / ArchiCAD do it: shape = what the grip *is* (static),
 * colour = what the grip is *doing right now* (dynamic). Do NOT reintroduce a
 * type→colour rule here; it collides with the temperature channel (see the
 * ADR-048 changelog entry for the `edge + cold → green` regression this replaced).
 *
 * @example
 * ```typescript
 * const colorMgr = new GripColorManager();
 *
 * // Custom color (highest priority)
 * colorMgr.getColor('cold', '#00ff00'); // '#00ff00'
 *
 * // Any grip at rest — vertex, edge, corner alike
 * colorMgr.getColor('cold'); // azure (GRIP_COLD_COLOR)
 *
 * // Hover / drag
 * colorMgr.getColor('warm'); // magenta
 * colorMgr.getColor('hot');  // red
 * ```
 */
export class GripColorManager {
  private static readonly HEX_COLOR_RE = /^#([0-9A-F]{3}){1,2}$/i;
  private static readonly DEFAULT_COLOR: Record<GripTemperature, string> = {
    cold: DEFAULT_GRIP_COLORS.COLD,
    warm: DEFAULT_GRIP_COLORS.WARM,
    hot:  DEFAULT_GRIP_COLORS.HOT,
    armed: DEFAULT_GRIP_COLORS.ARMED, // ADR-501 — orange armed/selected (multi-grip)
    snappable: DEFAULT_GRIP_COLORS.SNAPPABLE, // ADR-397 — cyan rotation snap target
  };
  /**
   * Get grip fill color based on priority system
   *
   * Priority order:
   * 1. customColor (if provided) - ADR-047 support
   * 2. Temperature color from settings (if available)
   * 3. Default temperature color (fallback)
   *
   * Grip *type* is deliberately NOT a parameter — see the class doc: type is
   * encoded by shape, colour is reserved for state.
   *
   * @param temperature - Current grip temperature
   * @param customColor - Optional custom color override (ADR-047)
   * @param settings - Optional grip settings from store
   * @returns Hex color string
   */
  getColor(
    temperature: GripTemperature,
    customColor?: string,
    settings?: Partial<GripSettings>
  ): string {
    // Priority 1: Custom color override (ADR-047 green close-indicator grip)
    if (customColor) {
      return this.validateColor(customColor);
    }

    // Priority 2: Temperature color from settings (cold/warm/hot only — 'snappable'
    // (ADR-397) and 'armed' (ADR-501) have no user-facing override, they fall
    // through to their default colours).
    if (settings?.colors && temperature !== 'snappable' && temperature !== 'armed') {
      const settingsColor = settings.colors[temperature];
      if (settingsColor) {
        return this.validateColor(settingsColor);
      }
    }

    // Priority 3: Default temperature color (fallback)
    return this.getDefaultColor(temperature);
  }

  /**
   * Get outline color for grips
   * Used for grip borders/contours
   *
   * @param settings - Optional grip settings from store
   * @returns Hex color string for outline
   */
  getOutlineColor(settings?: Partial<GripSettings>): string {
    if (settings?.colors?.contour) {
      return this.validateColor(settings.colors.contour);
    }
    return DEFAULT_GRIP_COLORS.CONTOUR;
  }

  /**
   * Get default color for temperature state
   * Fallback when settings not available
   *
   * @param temperature - Grip temperature
   * @returns Default hex color
   */
  private getDefaultColor(temperature: GripTemperature): string {
    return GripColorManager.DEFAULT_COLOR[temperature];
  }

  private validateColor(color: string): string {
    return GripColorManager.HEX_COLOR_RE.test(color) ? color : DEFAULT_GRIP_COLORS.COLD;
  }
}
