/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Utilities
 *
 * @version 1.0.0
 * @description Color parsing, formatting, and conversion utilities
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

import type { RGBColor, HSLColor, HSVColor, ParseResult, FormatOptions } from './types';
// 🏢 Color-Conversion SSoT (ADR-573): the hex/HSL/HSV math lives in `config/color-math`
// (big-player single colour module). These functions are thin adapters that preserve this
// module's public contract — `RGBColor`/`HSLColor`/`HSVColor` shapes, the throw-on-invalid
// `parseHex`, and the `FormatOptions` on `rgbToHex`.
import {
  parseHexAlpha,
  channelToHex,
  rgbToHsl as cmRgbToHsl,
  hslToRgb as cmHslToRgb,
  rgbToHsv as cmRgbToHsv,
  hsvToRgb as cmHsvToRgb,
} from '../../config/color-math';

// ===== PARSING =====

/**
 * Parse hex color string to RGB. Supports `#rgb` / `#rrggbb` / `#rrggbbaa`.
 * THROWS on invalid input — consumers rely on this (`aci.findClosestAci`,
 * `LegacyGridAdapter`). Delegates the parse to the `color-math` SSoT.
 */
export function parseHex(hex: string): RGBColor {
  const c = parseHexAlpha(hex);
  if (!c) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

/**
 * Parse RGB string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)")
 */
export function parseRgb(rgb: string): RGBColor {
  const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);

  if (!match) {
    throw new Error(`Invalid RGB color: ${rgb}`);
  }

  const [, r, g, b, a] = match;

  return {
    r: parseInt(r),
    g: parseInt(g),
    b: parseInt(b),
    a: a ? parseFloat(a) : 1,
  };
}

/**
 * Parse HSL string (e.g., "hsl(120, 100%, 50%)" or "hsla(120, 100%, 50%, 0.5)")
 */
export function parseHsl(hsl: string): HSLColor {
  const match = hsl.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/);

  if (!match) {
    throw new Error(`Invalid HSL color: ${hsl}`);
  }

  const [, h, s, l, a] = match;

  return {
    h: parseFloat(h),
    s: parseFloat(s),
    l: parseFloat(l),
    a: a ? parseFloat(a) : 1,
  };
}

/**
 * Parse any color string
 */
export function parseColor(color: string): ParseResult {
  try {
    let rgb: RGBColor;

    if (color.startsWith('#')) {
      rgb = parseHex(color);
    } else if (color.startsWith('rgb')) {
      rgb = parseRgb(color);
    } else if (color.startsWith('hsl')) {
      const hsl = parseHsl(color);
      rgb = hslToRgb(hsl);
    } else {
      throw new Error(`Unsupported color format: ${color}`);
    }

    const hsl = rgbToHsl(rgb);
    const hsv = rgbToHsv(rgb);
    const hex = rgbToHex(rgb);

    return {
      valid: true,
      color: { hex, rgb, hsl, hsv, alpha: rgb.a ?? 1 },
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== FORMATTING =====

/**
 * Format RGB to hex string
 */
export function rgbToHex(rgb: RGBColor, options: FormatOptions = {}): string {
  const { alpha = false, uppercase = false, short = false } = options;

  // 🏢 Color-Conversion SSoT (ADR-573): per-channel byte formatting via `channelToHex`
  // (clamp+round+2-digit). Uppercase is this module's format option.
  const toHex = (n: number) => {
    const hex = channelToHex(n);
    return uppercase ? hex.toUpperCase() : hex;
  };

  let hex = `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;

  // Add alpha if requested and not 1
  if (alpha && rgb.a !== undefined && rgb.a !== 1) {
    hex += toHex(rgb.a * 255);
  }

  // Shorten if possible (#RRGGBB → #RGB)
  if (short && hex.length === 6) {
    const [r1, r2, g1, g2, b1, b2] = hex;
    if (r1 === r2 && g1 === g2 && b1 === b2) {
      hex = r1 + g1 + b1;
    }
  }

  return `#${hex}`;
}

/**
 * Format RGB to rgb(a) string
 */
export function formatRgb(rgb: RGBColor, alpha: boolean = false): string {
  const { r, g, b, a = 1 } = rgb;

  if (alpha && a !== 1) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
  }

  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/**
 * Format HSL to hsl(a) string
 */
export function formatHsl(hsl: HSLColor, alpha: boolean = false): string {
  const { h, s, l, a = 1 } = hsl;

  if (alpha && a !== 1) {
    return `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a.toFixed(2)})`;
  }

  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

// ===== COLOR SPACE CONVERSIONS =====

/**
 * Convert RGB to HSL. Delegates the math to the `color-math` SSoT; carries alpha.
 */
export function rgbToHsl(rgb: RGBColor): HSLColor {
  const { h, s, l } = cmRgbToHsl(rgb);
  return { h, s, l, a: rgb.a };
}

/**
 * Convert HSL to RGB. Delegates the math to the `color-math` SSoT; carries alpha.
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  const { r, g, b } = cmHslToRgb(hsl);
  return { r, g, b, a: hsl.a };
}

/**
 * Convert RGB to HSV. Delegates the math to the `color-math` SSoT; carries alpha.
 */
export function rgbToHsv(rgb: RGBColor): HSVColor {
  const { h, s, v } = cmRgbToHsv(rgb);
  return { h, s, v, a: rgb.a };
}

/**
 * Convert HSV to RGB. Delegates the math to the `color-math` SSoT; carries alpha.
 */
export function hsvToRgb(hsv: HSVColor): RGBColor {
  const { r, g, b } = cmHsvToRgb(hsv);
  return { r, g, b, a: hsv.a };
}

// ===== VALIDATION =====

/**
 * Validate hex color format
 */
export function isValidHex(hex: string): boolean {
  const cleanHex = hex.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(cleanHex);
}

/**
 * Normalize hex color to standard format
 */
export function normalizeHex(hex: string, options: FormatOptions = {}): string {
  try {
    const rgb = parseHex(hex);
    return rgbToHex(rgb, options);
  } catch {
    return hex;
  }
}

/**
 * Normalise an arbitrary colour string to a 7-char `#rrggbb` hex suitable for a
 * native `<input type="color">` (which rejects alpha / rgba notation, falling back
 * to black). Accepts `#rrggbb`, `#rgb` (expanded), and `rgb()/rgba()` (alpha
 * dropped); anything else → `#ffffff`.
 *
 * 🏢 Color-Conversion SSoT (ADR-573): single home for what was duplicated verbatim
 * in `OpeningTagStyleColorWidget` + `OpeningTagStyleDialog`.
 */
export function toColorInputHex(raw: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  const rgba = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgba[1]!)}${hex(rgba[2]!)}${hex(rgba[3]!)}`;
  }
  return '#ffffff';
}

/**
 * Extract the opacity (0..1) encoded in a colour string. Handles `rgba(...)` and
 * `#rrggbbaa`; any other format → `fallback`.
 *
 * 🏢 Color-Conversion SSoT (ADR-573): single home for what was duplicated verbatim
 * across the ruler-settings widgets (`RulerMajor/Minor/BackgroundSettings`).
 */
export function extractColorOpacity(color: string, fallback = 1): number {
  if (color.includes('rgba')) {
    const parsed = parseColor(color);
    return parsed.valid ? parsed.color.alpha : fallback;
  }
  if (color.startsWith('#') && color.length === 9) {
    return parseInt(color.slice(7, 9), 16) / 255;
  }
  return fallback;
}

/**
 * Strip any alpha channel → opaque base `#rrggbb`. `rgba(...)` → hex; `#rrggbbaa`
 * → `#rrggbb`; anything else returned verbatim.
 *
 * 🏢 Color-Conversion SSoT (ADR-573): single home for the ruler widgets' base-colour
 * extraction (was duplicated as `getBaseColor` in `RulerMajor/MinorLinesSettings`).
 */
export function stripAlphaToBaseHex(color: string): string {
  if (color.includes('rgba')) {
    const parsed = parseColor(color);
    if (parsed.valid) return rgbToHex(parsed.color.rgb);
  }
  if (color.startsWith('#') && color.length === 9) {
    return color.slice(0, 7);
  }
  return color;
}
