/**
 * @fileoverview Grip Size Calculator - Centralized Size Calculation
 * @description Calculates grip sizes with temperature multipliers and DPI scaling
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO magic numbers
 */

import type { GripTemperature } from './types';
import {
  GRIP_SIZE_MULTIPLIERS,
  MIN_GRIP_SIZE,
  MAX_GRIP_SIZE,
} from './constants';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../entities/shared/geometry-utils';

// ============================================================================
// GRIP SIZE CALCULATOR CLASS
// ============================================================================

/**
 * Enterprise Grip Size Calculator
 * Centralized calculation of grip sizes with temperature states and DPI scaling
 *
 * @example
 * ```typescript
 * const calculator = new GripSizeCalculator();
 * const size = calculator.calculateSize(8, 'warm', 2.0); // Returns 20 (8 * 1.25 * 2.0)
 * ```
 */
export class GripSizeCalculator {
  /**
   * Calculate final grip size with all scaling factors
   *
   * @param baseSize - Base size from settings (typically 6-12 pixels)
   * @param temperature - Current grip temperature (cold/warm/hot)
   * @param dpiScale - DPI scaling factor (typically 1.0-3.0)
   * @param customMultiplier - Optional custom size multiplier
   * @returns Final size in pixels (clamped to valid range)
   *
   * @example
   * ```typescript
   * // Cold grip at 1x DPI: 8 * 1.0 * 1.0 = 8px
   * calculateSize(8, 'cold', 1.0); // 8
   *
   * // Warm grip at 2x DPI: 8 * 1.25 * 2.0 = 20px
   * calculateSize(8, 'warm', 2.0); // 20
   *
   * // Hot grip with custom multiplier: 8 * 1.5 * 1.0 * 0.5 = 6px
   * calculateSize(8, 'hot', 1.0, 0.5); // 6
   * ```
   */
  calculateSize(
    baseSize: number,
    temperature: GripTemperature,
    dpiScale: number,
    customMultiplier?: number
  ): number {
    // Step 1: Apply temperature multiplier (1.0, 1.25, or 1.5)
    let size = baseSize * this.getSizeMultiplier(temperature);

    // Step 2: Apply custom multiplier if provided (e.g., for midpoint grips)
    if (customMultiplier !== undefined) {
      size *= customMultiplier;
    }

    // Step 3: Apply DPI scaling
    size *= dpiScale;

    // Step 4: Clamp to valid range (MIN_GRIP_SIZE to MAX_GRIP_SIZE)
    size = this.clampSize(size);

    // Step 5: Round to integer for pixel-perfect rendering
    return Math.round(size);
  }

  /**
   * Get size multiplier for temperature state
   * Private helper for temperature-based scaling
   *
   * @param temperature - Grip temperature state
   * @returns Size multiplier (1.0, 1.25, or 1.5)
   */
  private getSizeMultiplier(temperature: GripTemperature): number {
    const multiplierKey = temperature.toUpperCase() as keyof typeof GRIP_SIZE_MULTIPLIERS;
    return GRIP_SIZE_MULTIPLIERS[multiplierKey];
  }

  /**
   * Clamp size to valid range
   * Ensures grips remain visible but not too large
   * 🏢 ADR-071: Using centralized clamp function
   *
   * @param size - Calculated size
   * @returns Clamped size
   */
  private clampSize(size: number): number {
    return clamp(size, MIN_GRIP_SIZE, MAX_GRIP_SIZE);
  }
}
