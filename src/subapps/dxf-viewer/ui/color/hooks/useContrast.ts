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

import { useMemo } from 'react';
import type { ContrastResult, RGBColor, TextSize } from '../types';
// 🏢 ADR-076: Centralized Color Conversion
import { parseHex, rgbToHex as centralizedRgbToHex } from '../utils';
// 🏢 ADR: Centralized Clamp Function
import { clamp255 } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-694 Φ10: WCAG luminance + contrast-ratio SSoT (`config/color-math`). This module used to
// carry verbatim copies of both; the sRGB linearisation there is built on the single IEC 61966-2-1
// transfer function shared with the colorimetric path. `contrastRatioRgb` (not `contrastRatio`) is
// the right seam here: this module owns a *different* error contract — `parseHex` THROWS on invalid
// input and the catch below reports `ratio: 0`, whereas `contrastRatio(hex, hex)` would swallow it
// and return `1`. Same math, contract preserved.
import { contrastRatioRgb } from '../../../config/color-math';

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
 * Calculate contrast ratio between two colors.
 *
 * 🏢 ADR-694 Φ10: thin adapter over the `color-math` SSoT. The local
 * `getRelativeLuminance` + `getContrastRatio` pair (a verbatim copy of the same
 * WCAG math, with the obsolete `0.03928` threshold W3C retired in May 2021) is gone.
 *
 * @see https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 */
function getContrastRatio(color1: RGBColor, color2: RGBColor): number {
  return contrastRatioRgb(color1, color2);
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
  // 🏢 ADR-694 Φ10 / N.18: the hook is a *memoisation* of `calculateContrast`, not a second copy
  // of it. The two used to hold byte-identical bodies (parse → ratio → same 6-field result, same
  // zeroed fallback) — jscpd flagged them as a structural clone. One implementation, two entry
  // points: `calculateContrast` for callers outside React, this hook for those inside it.
  return useMemo(
    () => calculateContrast(foreground, background),
    [foreground, background, textSize],
  );
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
 * Calculate contrast ratio (non-hook version).
 *
 * 🏢 ADR-694 Φ10: **the** single implementation — {@link useContrast} memoises this rather than
 * repeating it. Invalid input is reported as `ratio: 0` / `'0:1'` (this module's own error
 * contract: `parseHex` throws, we catch), deliberately *not* the `1` that `contrastRatio(hex, hex)`
 * returns. The warning moved here from the hook so both entry points surface bad colours.
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
    console.warn('[calculateContrast] Failed to calculate contrast:', error);
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
  const adjust = (c: number) => clamp255(c + factor * 128);

  return {
    r: adjust(rgb.r),
    g: adjust(rgb.g),
    b: adjust(rgb.b),
    a: rgb.a,
  };
}
