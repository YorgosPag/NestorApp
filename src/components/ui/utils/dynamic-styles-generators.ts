/**
 * 🎨 DYNAMIC STYLE GENERATORS + COMPOSITE — SRP MODULE
 *
 * Public pure-function class generators (no React), plus composite config
 * and cleanup utilities. Split from `dynamic-styles.ts` for SRP + size
 * compliance (ADR-314 Phase C.5.6). Consumers should import from
 * `./dynamic-styles` (barrel).
 */

import {
  formatColorWithOpacity,
  generateColorKey,
  generateDimensionKey,
  injectDynamicStyle,
  isValidColor,
  isValidDimension,
  isValidTransform,
  logger,
} from './dynamic-styles-internals';

// ============================================================================
// 🎨 DYNAMIC STYLE GENERATORS - NO INLINE STYLES
// ============================================================================

/**
 * Generate dynamic background color class
 *
 * @param color - Color value (hex, rgb, css variable)
 * @param opacity - Optional opacity (0-1)
 */
export const getDynamicBackgroundClass = (color?: string, opacity?: number): string => {
  if (!color) return '';

  if (!isValidColor(color)) {
    return '';
  }

  const colorKey = generateColorKey(color, opacity);
  const className = `dynamic-bg-${colorKey}`;

  injectDynamicStyle(className, 'background-color', formatColorWithOpacity(color, opacity));

  return className;
};

/**
 * Generate dynamic text color class
 */
export const getDynamicTextClass = (color?: string): string => {
  if (!color) return '';

  if (!isValidColor(color)) {
    logger.warn('Invalid color provided to getDynamicTextClass', { color });
    return '';
  }

  const colorKey = generateColorKey(color);
  const className = `dynamic-text-${colorKey}`;

  injectDynamicStyle(className, 'color', color);

  return className;
};

/**
 * Generate dynamic border color class
 */
export const getDynamicBorderClass = (color?: string, width: string = '1px'): string => {
  if (!color) return '';

  if (!isValidColor(color)) {
    logger.warn('Invalid color provided to getDynamicBorderClass', { color });
    return '';
  }

  const colorKey = generateColorKey(color);
  const className = `dynamic-border-${colorKey}`;

  injectDynamicStyle(className, 'border', `${width} solid ${color}`);

  return className;
};

/**
 * Generate dynamic width class
 */
export const getDynamicWidthClass = (width?: string): string => {
  if (!width) return '';

  if (!isValidDimension(width)) {
    logger.warn('Invalid width provided to getDynamicWidthClass', { width });
    return '';
  }

  const widthKey = generateDimensionKey(width);
  const className = `dynamic-w-${widthKey}`;

  injectDynamicStyle(className, 'width', width);

  return className;
};

/**
 * Generate dynamic transform class
 */
export const getDynamicTransformClass = (transform?: string): string => {
  if (!transform) return '';

  if (!isValidTransform(transform)) {
    logger.warn('Invalid transform provided to getDynamicTransformClass', { transform });
    return '';
  }

  const transformKey = generateDimensionKey(transform);
  const className = `dynamic-transform-${transformKey}`;

  injectDynamicStyle(className, 'transform', transform);

  return className;
};

/**
 * Generate dynamic height class
 */
export const getDynamicHeightClass = (height?: string): string => {
  if (!height) return '';

  if (!isValidDimension(height)) {
    logger.warn('Invalid height provided to getDynamicHeightClass', { height });
    return '';
  }

  const heightKey = generateDimensionKey(height);
  const className = `dynamic-h-${heightKey}`;

  injectDynamicStyle(className, 'height', height);

  return className;
};

