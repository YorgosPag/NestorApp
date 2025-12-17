/**
 * 🏗️ LAYOUT UTILITIES TOKENS - ENTERPRISE MODULE
 *
 * @description Κεντρικοποιημένο layout utility system που περιέχει όλα τα
 * positioning, dimensions, display και layout patterns της εφαρμογής
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Modularization
 *
 * 🔄 EXTRACTED FROM: src/styles/design-tokens.ts (~550 lines → modular)
 */

import React from 'react';

// ============================================================================
// LAYOUT UTILITIES - COMPREHENSIVE SYSTEM
// ============================================================================

export const layoutUtilities = {
  // Positioning patterns για dynamic placement
  positioning: {
    absolute: 'absolute' as const,
    relative: 'relative' as const,
    fixed: 'fixed' as const,
    sticky: 'sticky' as const,
  },

  // Dimension utilities για responsive sizing
  dimensions: {
    auto: 'auto' as const,
    full: '100%' as const,
    screen: '100vw' as const,
    screenHeight: '100vh' as const,
    fitContent: 'fit-content' as const,
    minContent: 'min-content' as const,
    maxContent: 'max-content' as const,
  },

  // Display state utilities για visibility control
  display: {
    block: 'block' as const,
    inline: 'inline' as const,
    inlineBlock: 'inline-block' as const,
    flex: 'flex' as const,
    grid: 'grid' as const,
    none: 'none' as const,
  },

  // Grid layout utilities για dynamic grid patterns
  grid: {
    templateColumns: (columns: number) => ({ gridTemplateColumns: `repeat(${columns}, 1fr)` }),
    templateColumnsCustom: (pattern: string) => ({ gridTemplateColumns: pattern }),
    autoColumns: (size: string) => ({ gridAutoColumns: size }),
    gap: (size: number, unit: 'px' | 'rem' = 'rem') => ({ gap: `${size}${unit}` }),
  },

  // Visibility utilities για show/hide patterns
  visibility: {
    visible: 'visible' as const,
    hidden: 'hidden' as const,
    collapse: 'collapse' as const,
  },

  // Overflow utilities για content handling
  overflow: {
    visible: 'visible' as const,
    hidden: 'hidden' as const,
    scroll: 'scroll' as const,
    auto: 'auto' as const,
  },

  // Flexbox utilities για flexible layouts
  flexbox: {
    direction: {
      row: 'row' as const,
      column: 'column' as const,
      rowReverse: 'row-reverse' as const,
      columnReverse: 'column-reverse' as const,
    },
    justify: {
      start: 'flex-start' as const,
      center: 'center' as const,
      end: 'flex-end' as const,
      between: 'space-between' as const,
      around: 'space-around' as const,
      evenly: 'space-evenly' as const,
    },
    align: {
      start: 'flex-start' as const,
      center: 'center' as const,
      end: 'flex-end' as const,
      stretch: 'stretch' as const,
      baseline: 'baseline' as const,
    },
    wrap: {
      nowrap: 'nowrap' as const,
      wrap: 'wrap' as const,
      wrapReverse: 'wrap-reverse' as const,
    },
  },

  // CSS Variables utilities για geo-canvas design system compatibility
  cssVars: {
    // Color utilities με CSS custom properties
    borderColor: (focused: boolean) =>
      focused ? 'var(--color-border-focus)' : 'var(--color-border-primary)',

    textColor: (variant: 'primary' | 'secondary' | 'tertiary') =>
      `var(--color-text-${variant})`,

    backgroundColor: (variant: 'primary' | 'secondary' | 'surface') =>
      `var(--color-bg-${variant})`,

    // Layout utilities με CSS vars
    fullWidth: { width: '100%' },

    inputBase: {
      width: '100%',
      padding: 'var(--spacing-3)',
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 'var(--font-size-sm)',
      lineHeight: 'var(--line-height-normal)',
      color: 'var(--color-text-primary)',
      transition: 'border-color var(--duration-base) var(--easing-ease-in-out)',
    },

    absoluteCenterY: {
      position: 'absolute' as const,
      top: '50%',
      transform: 'translateY(-50%)'
    },

    // Spacing utilities με CSS vars
    spacing: (size: string | number) => `var(--spacing-${size})`,

    padding: (vertical: string | number, horizontal?: string | number) =>
      horizontal
        ? `var(--spacing-${vertical}) var(--spacing-${horizontal})`
        : `var(--spacing-${vertical})`,

    margin: (vertical: string | number, horizontal?: string | number) =>
      horizontal
        ? `var(--spacing-${vertical}) var(--spacing-${horizontal})`
        : `var(--spacing-${vertical})`,
  },

  // Percentage utilities για responsive layouts
  percentage: (value: number): string => `${value}%`,

  // Pixels utilities για exact measurements
  pixels: (value: number): string => `${value}px`,

  // Position utilities για absolute positioning
  position: (config: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  }) => {
    const styles: Record<string, string> = {};

    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        styles[key] = typeof value === 'number' ? `${value}px` : value;
      }
    });

    return styles;
  },

  // Z-index utilities για layering
  zIndex: {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
} as const;

// ============================================================================
// RESPONSIVE LAYOUT UTILITIES
// ============================================================================

export const responsiveLayoutUtilities = {
  /**
   * Responsive container με breakpoints
   */
  responsiveContainer: (size: 'sm' | 'md' | 'lg' | 'xl' | 'full'): React.CSSProperties => {
    const maxWidths = {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      full: '100%'
    };

    return {
      maxWidth: maxWidths[size],
      margin: '0 auto',
      padding: '0 var(--spacing-4)',
      width: '100%'
    };
  },

  /**
   * Responsive spacer component
   */
  responsiveSpacer: (
    spacingValue: number,
    direction: 'horizontal' | 'vertical'
  ): React.CSSProperties => ({
    [direction === 'horizontal' ? 'width' : 'height']: `var(--spacing-${spacingValue})`,
    [direction === 'horizontal' ? 'height' : 'width']: direction === 'horizontal' ? '1px' : '100%',
    flexShrink: 0
  }),

  /**
   * Mobile layout spacing
   */
  mobileLayoutSpacing: (gap: number): React.CSSProperties => ({
    marginBottom: `var(--spacing-${gap})`
  }),

  /**
   * Dashboard layout utilities με responsive positioning
   */
  dashboardLayout: (): React.CSSProperties => ({
    minHeight: '100vh',
    backgroundColor: 'var(--color-bg-tertiary)',
    fontFamily: 'var(--font-family-sans)',
    color: 'var(--color-text-primary)',
    position: 'relative' as const,
    overflow: 'hidden'
  }),

  /**
   * Dashboard main content area με responsive margins
   */
  dashboardMainContent: (
    sidebarWidth: number,
    sidebarCollapsed: boolean,
    headerHeight: number,
    footerHeight: number
  ): React.CSSProperties => ({
    marginLeft: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
    marginTop: `${headerHeight}px`,
    marginBottom: footerHeight > 0 ? `${footerHeight}px` : 0,
    minHeight: `calc(100vh - ${headerHeight}px - ${footerHeight}px)`,
    backgroundColor: 'var(--color-bg-tertiary)',
    transition: 'margin-left var(--duration-base) var(--easing-ease-in-out)',
    overflow: 'auto' as const
  }),

  /**
   * Content container με centering και max-width
   */
  dashboardContentContainer: (
    fluid: boolean,
    centered: boolean
  ): React.CSSProperties => ({
    maxWidth: fluid ? '100%' : 'var(--container-max-width, 1280px)',
    margin: centered ? '0 auto' : '0',
    padding: 'var(--spacing-6)',
    width: '100%'
  }),
} as const;

// ============================================================================
// LAYOUT PRESETS - COMMON PATTERNS
// ============================================================================

export const layoutPresets = {
  // Common layout patterns
  centerContent: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullScreenOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: layoutUtilities.zIndex.overlay,
  },

  cardLayout: {
    backgroundColor: 'var(--color-bg-primary)',
    border: '1px solid var(--color-border-primary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 'var(--spacing-4)',
    boxShadow: 'var(--shadow-sm)',
  },

  stickyHeader: {
    position: 'sticky' as const,
    top: 0,
    zIndex: layoutUtilities.zIndex.sticky,
    backgroundColor: 'var(--color-bg-primary)',
  },
} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  layoutUtilities as designTokenLayoutUtilities,
  responsiveLayoutUtilities as designTokenResponsiveLayoutUtilities,
  layoutPresets as designTokenLayoutPresets
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type LayoutUtilities = typeof layoutUtilities;
export type ResponsiveLayoutUtilities = typeof responsiveLayoutUtilities;
export type LayoutPresets = typeof layoutPresets;
export type FlexDirection = keyof typeof layoutUtilities.flexbox.direction;
export type JustifyContent = keyof typeof layoutUtilities.flexbox.justify;
export type AlignItems = keyof typeof layoutUtilities.flexbox.align;

/**
 * ✅ ENTERPRISE LAYOUT UTILITIES MODULE COMPLETE
 *
 * Features:
 * 1. ✅ Comprehensive layout utility system από monolithic design-tokens.ts
 * 2. ✅ CSS Variables support για geo-canvas compatibility
 * 3. ✅ Responsive layout utilities με breakpoints
 * 4. ✅ Dashboard layout patterns που χρησιμοποιούνται στην εφαρμογή
 * 5. ✅ Flexbox και Grid utilities για modern layouts
 * 6. ✅ Position και Z-index management
 * 7. ✅ Layout presets για common patterns
 * 8. ✅ Type-safe access με TypeScript definitions
 * 9. ✅ Legacy compatibility exports
 * 10. ✅ Enterprise documentation standards
 *
 * Migration Benefits:
 * - 🏗️ Separated ~550 lines από monolithic file
 * - 🏢 Professional modular architecture
 * - ⚡ Better tree-shaking και performance
 * - 📱 Enhanced responsive design support
 * - 🔧 Easier maintenance και updates
 * - 👥 Better team collaboration
 *
 * Result: Fortune 500-class layout utility management system
 */