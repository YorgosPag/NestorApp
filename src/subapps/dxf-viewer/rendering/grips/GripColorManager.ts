/**
 * @fileoverview Grip Color Manager - Centralized Color Mapping
 * @description Maps temperature/type to fill colors with priority system
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO hardcoded colors
 */

import type { GripTemperature, GripType, GripSettings } from './types';
import { DEFAULT_GRIP_COLORS, EDGE_GRIP_COLOR } from './constants';

// ============================================================================
// GRIP COLOR MANAGER CLASS
// ============================================================================

/**
 * Enterprise Grip Color Manager
 * Centralized color selection with priority system:
 * 1. Custom color override (ADR-047)
 * 2. Type-specific color (edge grips cold → green)
 * 3. Temperature-based color from settings
 * 4. Default temperature color
 *
 * @example
 * ```typescript
 * const colorMgr = new GripColorManager();
 *
 * // Custom color (highest priority)
 * colorMgr.getColor('cold', 'vertex', '#00ff00'); // '#00ff00'
 *
 * // Edge grip cold (type-specific)
 * colorMgr.getColor('cold', 'edge'); // Green color
 *
 * // Edge grip hot (temperature overrides type)
 * colorMgr.getColor('hot', 'edge'); // Red color (hot overrides green)
 * ```
 */
export class GripColorManager {
  /**
   * Get grip fill color based on priority system
   *
   * Priority order:
   * 1. customColor (if provided) - ADR-047 support
   * 2. Type-specific color (edge grips cold → green)
   * 3. Temperature color from settings (if available)
   * 4. Default temperature color (fallback)
   *
   * @param temperature - Current grip temperature
   * @param type - Grip type (vertex/edge/etc.)
   * @param customColor - Optional custom color override (ADR-047)
   * @param settings - Optional grip settings from store
   * @returns Hex color string
   */
  getColor(
    temperature: GripTemperature,
    type: GripType,
    customColor?: string,
    settings?: Partial<GripSettings>
  ): string {
    // Priority 1: Custom color override (ADR-047 green grip support)
    if (customColor) {
      return this.validateColor(customColor);
    }

    // Priority 2: Type-specific color (edge grips cold → green)
    // NOTE: Only for COLD edge grips - warm/hot use temperature colors
    if (type === 'edge' && temperature === 'cold') {
      return EDGE_GRIP_COLOR;
    }

    // Priority 3: Temperature color from settings
    if (settings?.colors) {
      const settingsColor = settings.colors[temperature];
      if (settingsColor) {
        return this.validateColor(settingsColor);
      }
    }

    // Priority 4: Default temperature color (fallback)
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
    const colorKey = temperature.toUpperCase() as keyof typeof DEFAULT_GRIP_COLORS;
    return DEFAULT_GRIP_COLORS[colorKey] || DEFAULT_GRIP_COLORS.COLD;
  }

  /**
   * Validate hex color format
   * Ensures color is valid hex string
   *
   * @param color - Color string to validate
   * @returns Valid hex color or fallback
   */
  private validateColor(color: string): string {
    // Validate hex color format (#RRGGBB or #RGB)
    const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(color);
    return isValidHex ? color : DEFAULT_GRIP_COLORS.COLD;
  }
}
