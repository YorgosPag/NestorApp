/**
 * 🎨 DYNAMIC STYLING INTERNALS — SRP MODULE
 *
 * Shared validators, CSS class-key generators, color/dimension formatting,
 * and DOM style injection. Consumed by `dynamic-styles.ts` (public generators)
 * and indirectly by `dynamic-styles-hooks.ts`.
 *
 * NOTE: key-generators are intentionally named `generate*Key` (not `generate*Id`):
 * they produce CSS class suffixes, not entity IDs. See ADR-314 Phase C.5.6.
 */

import { createModuleLogger } from '@/lib/telemetry';

export const logger = createModuleLogger('DynamicStyles');

// ============================================================================
// 🔧 VALIDATORS
// ============================================================================

/**
 * Validate if color string is valid CSS color
 */
export function isValidColor(color: string): boolean {
  if (color.startsWith('var(')) return true;
  if (color.match(/^#[0-9A-Fa-f]{3,6}$/)) return true;
  if (color.match(/^rgba?\(/)) return true;
  if (color.match(/^[a-zA-Z]+$/)) return true;

  // ✅ ENTERPRISE FIX: Allow Tailwind CSS classes from COLOR_BRIDGE
  if (color.startsWith('bg-') || color.startsWith('text-') || color.startsWith('border-')) {
    return true;
  }

  return false;
}

/**
 * Validate if dimension string is valid CSS size
 */
export function isValidDimension(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (value.match(/^[0-9.]+%$/)) return true;
  if (value.match(/^[0-9.]+(px|rem|em|vh|vw|vmin|vmax|ch|ex)$/)) return true;

  return false;
}

/**
 * Validate if transform string is a valid CSS transform
 */
export function isValidTransform(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (/^(translate|rotate|scale|skew|matrix|perspective)/.test(value)) return true;
  return false;
}

/**
 * Validate if background-image value is valid
 */
export function isValidBackgroundImage(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (value.startsWith('url(')) return true;
  if (/^(linear-gradient|radial-gradient|conic-gradient)/.test(value)) return true;

  return false;
}

// ============================================================================
// 🔑 CSS CLASS-KEY GENERATORS (NOT entity IDs)
// ============================================================================

/**
 * Generate unique CSS class-key for dimension values (width/height/transform)
 */
export function generateDimensionKey(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 12);
}

/**
 * Generate unique CSS class-key for color (optional opacity suffix)
 */
export function generateColorKey(color: string, opacity?: number): string {
  const baseKey = color
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 8);

  return opacity ? `${baseKey}-${Math.round(opacity * 100)}` : baseKey;
}

// ============================================================================
// 🎨 COLOR FORMATTING
// ============================================================================

/**
 * Format color with opacity (hex → rgba, var() → color-mix)
 */
export function formatColorWithOpacity(color: string, opacity?: number): string {
  if (!opacity || opacity === 1) return color;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  if (color.startsWith('var(')) {
    return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
  }

  return color;
}

// ============================================================================
// 💉 DOM STYLE INJECTION
// ============================================================================

/**
 * Inject dynamic CSS rule into `<style id="dynamic-styles">` container.
 * SSR-safe: no-op on server.
 */
export function injectDynamicStyle(className: string, property: string, value: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (document.querySelector(`.${className}`)) return;

  let styleContainer = document.getElementById('dynamic-styles');
  if (!styleContainer) {
    styleContainer = document.createElement('style');
    styleContainer.id = 'dynamic-styles';
    styleContainer.setAttribute('data-source', 'enterprise-dynamic-styles');
    document.head.appendChild(styleContainer);
  }

  const rule = `.${className} { ${property}: ${value}; }`;
  styleContainer.textContent += rule + '\n';
}
