/**
 * 🏢 ENTERPRISE COLOR SYSTEM - Utilities
 *
 * @version 1.0.0
 * @description Color parsing, formatting, and conversion utilities
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI) + ChatGPT-5
 * @since 2025-10-07
 */

import type { ColorValue, RGBColor, HSLColor, HSVColor, ParseResult, FormatOptions } from './types';

// ===== PARSING =====

/**
 * Parse hex color string to RGB
 */
export function parseHex(hex: string): RGBColor {
  let cleanHex = hex.trim();

  if (cleanHex.startsWith('#')) {
    cleanHex = cleanHex.slice(1);
  }

  // Expand shorthand #RGB → #RRGGBB
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }

  // Parse components
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  const a = cleanHex.length === 8 ? parseInt(cleanHex.slice(6, 8), 16) / 255 : 1;

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return { r, g, b, a };
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

  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
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
 * Convert RGB to HSL
 */
export function rgbToHsl(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
    a: rgb.a,
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
    a: hsl.a,
  };
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(rgb: RGBColor): HSVColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    v: v * 100,
    a: rgb.a,
  };
}

/**
 * Convert HSV to RGB
 */
export function hsvToRgb(hsv: HSVColor): RGBColor {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r, g, b;

  switch (i % 6) {
    case 0:
      [r, g, b] = [v, t, p];
      break;
    case 1:
      [r, g, b] = [q, v, p];
      break;
    case 2:
      [r, g, b] = [p, v, t];
      break;
    case 3:
      [r, g, b] = [p, q, v];
      break;
    case 4:
      [r, g, b] = [t, p, v];
      break;
    case 5:
      [r, g, b] = [v, p, q];
      break;
    default:
      [r, g, b] = [0, 0, 0];
  }

  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
    a: hsv.a,
  };
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
