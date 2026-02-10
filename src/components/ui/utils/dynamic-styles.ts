/**
 * 🎨 DYNAMIC STYLING UTILITIES - CLAUDE.md COMPLIANCE
 *
 * Enterprise solution για dynamic styling χωρίς inline styles.
 * Αντικαθιστά style={{ backgroundColor: color }} με centralized CSS-in-JS patterns.
 *
 * ✅ BENEFITS:
 * - Zero inline styles (CLAUDE.md compliant)
 * - Type-safe dynamic styling
 * - Performance optimized (memoized classes)
 * - Consistent color validation
 * - Enterprise-grade error handling
 *
 * 📍 MIGRATION:
 * - style={{ backgroundColor: color }} → className={getDynamicBackgroundClass(color)}
 * - style={{ color: textColor }} → className={getDynamicTextClass(textColor)}
 * - style={{ borderColor: border }} → className={getDynamicBorderClass(border)}
 */

import { useMemo } from 'react';

// ============================================================================
// 🎨 DYNAMIC STYLE GENERATORS - NO INLINE STYLES
// ============================================================================

/**
 * Generate dynamic background color class
 *
 * @param color - Color value (hex, rgb, css variable)
 * @param opacity - Optional opacity (0-1)
 * @returns CSS class name with dynamic background
 *
 * @example getDynamicBackgroundClass('#ff0000') // Returns dynamic class
 * @example getDynamicBackgroundClass('var(--primary)') // CSS variable support
 */
export const getDynamicBackgroundClass = (color?: string, opacity?: number): string => {
  if (!color) return '';

  // Validate color format - silently return empty for invalid colors
  if (!isValidColor(color)) {
    return '';
  }

  // Generate unique class identifier
  const colorId = generateColorId(color, opacity);
  const className = `dynamic-bg-${colorId}`;

  // Inject dynamic style if not exists
  injectDynamicStyle(className, 'background-color', formatColorWithOpacity(color, opacity));

  return className;
};

/**
 * Generate dynamic text color class
 *
 * @param color - Color value
 * @returns CSS class name with dynamic text color
 */
export const getDynamicTextClass = (color?: string): string => {
  if (!color) return '';

  if (!isValidColor(color)) {
    console.warn(`Invalid color provided to getDynamicTextClass: ${color}`);
    return '';
  }

  const colorId = generateColorId(color);
  const className = `dynamic-text-${colorId}`;

  injectDynamicStyle(className, 'color', color);

  return className;
};

/**
 * Generate dynamic border color class
 *
 * @param color - Border color value
 * @param width - Border width (default: 1px)
 * @returns CSS class name with dynamic border
 */
export const getDynamicBorderClass = (color?: string, width: string = '1px'): string => {
  if (!color) return '';

  if (!isValidColor(color)) {
    console.warn(`Invalid color provided to getDynamicBorderClass: ${color}`);
    return '';
  }

  const colorId = generateColorId(color);
  const className = `dynamic-border-${colorId}`;

  injectDynamicStyle(className, 'border', `${width} solid ${color}`);

  return className;
};

/**
 * Generate dynamic width class
 *
 * @param width - CSS width value (e.g. '50%', '120px', 'var(--x)', 'calc(...)')
 * @returns CSS class name with dynamic width
 */
export const getDynamicWidthClass = (width?: string): string => {
  if (!width) return '';

  if (!isValidDimension(width)) {
    console.warn(`Invalid width provided to getDynamicWidthClass: ${width}`);
    return '';
  }

  const widthId = generateDimensionId(width);
  const className = `dynamic-w-${widthId}`;

  injectDynamicStyle(className, 'width', width);

  return className;
};

/**
 * Generate dynamic transform class
 *
 * @param transform - CSS transform value (e.g. 'translateX(-50%)')
 * @returns CSS class name with dynamic transform
 */
export const getDynamicTransformClass = (transform?: string): string => {
  if (!transform) return '';

  if (!isValidTransform(transform)) {
    console.warn(`Invalid transform provided to getDynamicTransformClass: ${transform}`);
    return '';
  }

  const transformId = generateDimensionId(transform);
  const className = `dynamic-transform-${transformId}`;

  injectDynamicStyle(className, 'transform', transform);

  return className;
};

/**
 * Generate dynamic height class
 *
 * @param height - CSS height value (e.g. '50%', '120px', 'var(--x)', 'calc(...)')
 * @returns CSS class name with dynamic height
 */
export const getDynamicHeightClass = (height?: string): string => {
  if (!height) return '';

  if (!isValidDimension(height)) {
    console.warn(`Invalid height provided to getDynamicHeightClass: ${height}`);
    return '';
  }

  const heightId = generateDimensionId(height);
  const className = `dynamic-h-${heightId}`;

  injectDynamicStyle(className, 'height', height);

  return className;
};

// ============================================================================
// 🔧 UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate if color string is valid CSS color
 */
function isValidColor(color: string): boolean {
  // Allow CSS variables
  if (color.startsWith('var(')) return true;

  // Allow hex colors
  if (color.match(/^#[0-9A-Fa-f]{3,6}$/)) return true;

  // Allow rgb/rgba
  if (color.match(/^rgba?\(/)) return true;

  // Allow named colors (basic check)
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
function isValidDimension(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (value.match(/^[0-9.]+%$/)) return true;
  if (value.match(/^[0-9.]+(px|rem|em|vh|vw|vmin|vmax|ch|ex)$/)) return true;

  return false;
}

/**
 * Validate if transform string is a valid CSS transform
 */
function isValidTransform(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (/^(translate|rotate|scale|skew|matrix|perspective)/.test(value)) return true;
  return false;
}

/**
 * Generate unique identifier for dimension values (width/height)
 */
function generateDimensionId(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 12);
}

/**
 * Generate unique identifier for color
 */
function generateColorId(color: string, opacity?: number): string {
  const baseId = color
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 8);

  return opacity ? `${baseId}-${Math.round(opacity * 100)}` : baseId;
}

/**
 * Format color with opacity
 */
function formatColorWithOpacity(color: string, opacity?: number): string {
  if (!opacity || opacity === 1) return color;

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Handle CSS variables with opacity
  if (color.startsWith('var(')) {
    return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
  }

  return color;
}

/**
 * Inject dynamic CSS style into document
 */
function injectDynamicStyle(className: string, property: string, value: string): void {
  // 🌐 SERVER-SIDE RENDERING SAFETY: Check if we're in the browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return; // Skip during server-side rendering
  }

  // Check if style already exists
  if (document.querySelector(`.${className}`)) return;

  // Create or get dynamic styles container
  let styleContainer = document.getElementById('dynamic-styles');
  if (!styleContainer) {
    styleContainer = document.createElement('style');
    styleContainer.id = 'dynamic-styles';
    styleContainer.setAttribute('data-source', 'enterprise-dynamic-styles');
    document.head.appendChild(styleContainer);
  }

  // Add CSS rule
  const rule = `.${className} { ${property}: ${value}; }`;
  styleContainer.textContent += rule + '\n';
}

// ============================================================================
// 🪝 REACT HOOKS FOR DYNAMIC STYLING
// ============================================================================

/**
 * React hook for memoized dynamic background class
 *
 * @param color - Background color
 * @param opacity - Optional opacity
 * @returns Memoized CSS class name
 */
export const useDynamicBackgroundClass = (color?: string, opacity?: number): string => {
  return useMemo(() => {
    return getDynamicBackgroundClass(color, opacity);
  }, [color, opacity]);
};

/**
 * React hook for memoized dynamic text class
 */
export const useDynamicTextClass = (color?: string): string => {
  return useMemo(() => {
    return getDynamicTextClass(color);
  }, [color]);
};

/**
 * React hook for memoized dynamic border class
 */
export const useDynamicBorderClass = (color?: string, width?: string): string => {
  return useMemo(() => {
    return getDynamicBorderClass(color, width);
  }, [color, width]);
};

/**
 * React hook for memoized dynamic width class
 *
 * @param width - Width value
 * @returns Memoized CSS class name
 */
export const useDynamicWidthClass = (width?: string): string => {
  return useMemo(() => {
    return getDynamicWidthClass(width);
  }, [width]);
};

/**
 * React hook for memoized dynamic transform class
 *
 * @param transform - Transform value
 * @returns Memoized CSS class name
 */
export const useDynamicTransformClass = (transform?: string): string => {
  return useMemo(() => {
    return getDynamicTransformClass(transform);
  }, [transform]);
};

/**
 * React hook for memoized dynamic height class
 *
 * @param height - Height value
 * @returns Memoized CSS class name
 */
export const useDynamicHeightClass = (height?: string): string => {
  return useMemo(() => {
    return getDynamicHeightClass(height);
  }, [height]);
};

// ============================================================================
// 🎯 COMPOSITE DYNAMIC CLASSES
// ============================================================================

/**
 * Generate complete dynamic style classes for complex elements
 *
 * @param config - Style configuration object
 * @returns Combined CSS class names
 *
 * @example
 * const classes = getDynamicElementClasses({
 *   backgroundColor: '#ff0000',
 *   textColor: '#ffffff',
 *   borderColor: '#000000'
 * });
 */
export interface DynamicStyleConfig {
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  borderColor?: string;
  borderWidth?: string;
}

export const getDynamicElementClasses = (config: DynamicStyleConfig): string => {
  const classes: string[] = [];

  if (config.backgroundColor) {
    const bgClass = getDynamicBackgroundClass(config.backgroundColor, config.backgroundOpacity);
    if (bgClass) classes.push(bgClass);
  }

  if (config.textColor) {
    const textClass = getDynamicTextClass(config.textColor);
    if (textClass) classes.push(textClass);
  }

  if (config.borderColor) {
    const borderClass = getDynamicBorderClass(config.borderColor, config.borderWidth);
    if (borderClass) classes.push(borderClass);
  }

  return classes.join(' ');
};

/**
 * React hook for complete dynamic element styling
 */
export const useDynamicElementClasses = (config: DynamicStyleConfig): string => {
  return useMemo(() => {
    return getDynamicElementClasses(config);
  }, [config.backgroundColor, config.backgroundOpacity, config.textColor, config.borderColor, config.borderWidth]);
};

// ============================================================================
// 🧹 CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up all dynamic styles (for testing/development)
 */
export const clearDynamicStyles = (): void => {
  const styleContainer = document.getElementById('dynamic-styles');
  if (styleContainer) {
    styleContainer.remove();
  }
};

/**
 * Get current dynamic styles count (for debugging)
 */
export const getDynamicStylesCount = (): number => {
  const styleContainer = document.getElementById('dynamic-styles');
  if (!styleContainer) return 0;

  return (styleContainer.textContent?.split('\n').filter(line => line.trim()).length) || 0;
};


