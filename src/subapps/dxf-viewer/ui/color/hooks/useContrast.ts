/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Contrast Hook
 *
 * @version 1.0.0
 * @description WCAG 2.1 contrast ratio calculator and compliance checker
 *
 * Features:
 * - Calculate contrast ratio between two colors
 * - Check WCAG AA/AAA compliance for normal/large text
 * - Suggest nearest accessible colors
 * - Support for alpha channel
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

import React, { useMemo } from 'react';
import type { ContrastResult, RGBColor, TextSize } from '../types';
// 🏢 ADR-076: Centralized Color Conversion
import { parseHex, rgbToHex as centralizedRgbToHex } from '../utils';

// ===== CONSTANTS =====

/**
 * WCAG 2.1 contrast ratio thresholds
 */
const WCAG_THRESHOLDS = {
  AA_NORMAL: 4.5, // 4.5:1 for normal text
  AAA_NORMAL: 7.0, // 7:1 for normal text
  AA_LARGE: 3.0, // 3:1 for large text (18pt+ or 14pt+ bold)
  AAA_LARGE: 4.5, // 4.5:1 for large text
} as const;

/**
 * Calculate relative luminance (WCAG formula)
 *
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(rgb: RGBColor): number {
  const { r, g, b } = rgb;

  // Normalize to 0-1
  const [rs, gs, bs] = [r, g, b].map((c) => c / 255);

  // Apply sRGB gamma correction
  const [rLin, gLin, bLin] = [rs, gs, bs].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  // Calculate luminance
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculate contrast ratio between two colors
 *
 * @see https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
function getContrastRatio(color1: RGBColor, color2: RGBColor): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Format contrast ratio as string (e.g., "4.5:1")
 */
function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

// ===== MAIN HOOK =====

/**
 * Calculate WCAG contrast ratio and compliance
 *
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param textSize - Text size category (default: 'normal')
 *
 * @example
 * ```tsx
 * const { ratio, passAA, passAAA, ratioString } = useContrast('#000000', '#ffffff');
 * // ratio: 21
 * // passAA: true
 * // passAAA: true
 * // ratioString: "21.00:1"
 * ```
 */
export function useContrast(
  foreground: string,
  background: string,
  textSize: TextSize = 'normal'
): ContrastResult {
  return useMemo(() => {
    try {
      // 🏢 ADR-076: Use centralized parseHex
      const fg = parseHex(foreground);
      const bg = parseHex(background);

      const ratio = getContrastRatio(fg, bg);

      return {
        ratio,
        passAA: ratio >= WCAG_THRESHOLDS.AA_NORMAL,
        passAAA: ratio >= WCAG_THRESHOLDS.AAA_NORMAL,
        passAALarge: ratio >= WCAG_THRESHOLDS.AA_LARGE,
        passAAALarge: ratio >= WCAG_THRESHOLDS.AAA_LARGE,
        ratioString: formatRatio(ratio),
      };
    } catch (error) {
      console.warn('[useContrast] Failed to calculate contrast:', error);
      return {
        ratio: 0,
        passAA: false,
        passAAA: false,
        passAALarge: false,
        passAAALarge: false,
        ratioString: '0:1',
      };
    }
  }, [foreground, background, textSize]);
}

/**
 * Check if contrast meets WCAG requirements
 */
export function useContrastCheck(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  textSize: TextSize = 'normal'
): boolean {
  const { ratio } = useContrast(foreground, background, textSize);

  if (textSize === 'large') {
    return level === 'AA' ? ratio >= WCAG_THRESHOLDS.AA_LARGE : ratio >= WCAG_THRESHOLDS.AAA_LARGE;
  }

  return level === 'AA' ? ratio >= WCAG_THRESHOLDS.AA_NORMAL : ratio >= WCAG_THRESHOLDS.AAA_NORMAL;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Calculate contrast ratio (non-hook version)
 */
export function calculateContrast(foreground: string, background: string): ContrastResult {
  try {
    // 🏢 ADR-076: Use centralized parseHex
    const fg = parseHex(foreground);
    const bg = parseHex(background);

    const ratio = getContrastRatio(fg, bg);

    return {
      ratio,
      passAA: ratio >= WCAG_THRESHOLDS.AA_NORMAL,
      passAAA: ratio >= WCAG_THRESHOLDS.AAA_NORMAL,
      passAALarge: ratio >= WCAG_THRESHOLDS.AA_LARGE,
      passAAALarge: ratio >= WCAG_THRESHOLDS.AAA_LARGE,
      ratioString: formatRatio(ratio),
    };
  } catch (error) {
    return {
      ratio: 0,
      passAA: false,
      passAAA: false,
      passAALarge: false,
      passAAALarge: false,
      ratioString: '0:1',
    };
  }
}

/**
 * Find nearest accessible color
 *
 * Adjusts lightness of foreground color to meet WCAG requirements
 */
export function findAccessibleColor(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  textSize: TextSize = 'normal'
): string {
  const targetRatio =
    textSize === 'large'
      ? level === 'AA'
        ? WCAG_THRESHOLDS.AA_LARGE
        : WCAG_THRESHOLDS.AAA_LARGE
      : level === 'AA'
      ? WCAG_THRESHOLDS.AA_NORMAL
      : WCAG_THRESHOLDS.AAA_NORMAL;

  // 🏢 ADR-076: Use centralized parseHex
  const fg = parseHex(foreground);
  const bg = parseHex(background);

  let bestColor = foreground;
  let bestRatio = getContrastRatio(fg, bg);

  // Try adjusting lightness
  for (let lightness = 0; lightness <= 100; lightness += 5) {
    const adjustedFg = adjustLightness(fg, lightness);
    const ratio = getContrastRatio(adjustedFg, bg);

    if (ratio >= targetRatio && Math.abs(ratio - targetRatio) < Math.abs(bestRatio - targetRatio)) {
      bestRatio = ratio;
      // 🏢 ADR-076: Use centralized rgbToHex
      bestColor = centralizedRgbToHex(adjustedFg);
    }
  }

  return bestColor;
}

/**
 * Adjust lightness of RGB color
 */
function adjustLightness(rgb: RGBColor, lightness: number): RGBColor {
  const factor = lightness / 50 - 1; // -1 to 1
  const adjust = (c: number) => Math.max(0, Math.min(255, c + factor * 128));

  return {
    r: adjust(rgb.r),
    g: adjust(rgb.g),
    b: adjust(rgb.b),
    a: rgb.a,
  };
}
