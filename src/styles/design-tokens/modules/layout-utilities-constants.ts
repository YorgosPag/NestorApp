/**
 * Layout Utilities Module — positioning, dimensions, display, grid, CSS vars
 * Extracted from design-tokens.ts for modular architecture
 */

import * as React from 'react';
import { colors, typography } from './foundations';
import { zIndex } from './layout';
import { chartComponents } from './chart-components';

export const layoutUtilities = {
  chartComponents,
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

  // 🏢 ENTERPRISE: Content area dimensions
  // Based on: Material Design (Google), Carbon (IBM), Fluent UI (Microsoft)
  // These tokens define minimum heights for content containers to ensure
  // consistent UX across different screen sizes and content types
  contentAreas: {
    // Tab content minimum heights
    tabContent: {
      sm: '300px',   // Compact tabs (settings, forms)
      md: '450px',   // Standard tabs (lists, details)
      lg: '600px',   // Large content tabs (floorplans, viewers)
      xl: '800px',   // Full-screen content (CAD viewers, maps)
    },
    // Viewer/preview minimum heights
    viewer: {
      compact: '350px',  // Thumbnail previews
      standard: '450px', // Document/PDF viewers
      expanded: '600px', // Floorplan/CAD viewers
      fullscreen: '80vh', // Immersive viewers
    },
    // Tailwind class equivalents for direct className usage
    tailwind: {
      tabContentSm: 'min-h-[300px]',
      tabContentMd: 'min-h-[450px]',
      tabContentLg: 'min-h-[600px]',
      tabContentXl: 'min-h-[800px]',
      viewerCompact: 'min-h-[350px]',
      viewerStandard: 'min-h-[450px]',
      viewerExpanded: 'min-h-[600px]',
      viewerFullscreen: 'min-h-[80vh]',
    },
  },

  // Dynamic percentage generator για width/height
  percentage: (value: number): string => `${Math.max(0, Math.min(100, value))}%`,

  // Dynamic pixel value generator
  pixels: (value: number): string => `${value}px`,

  // Dynamic rem value generator
  rem: (value: number): string => `${value}rem`,

  // Random height generator για chart skeletons & data visualization
  randomHeight: (min: number = 20, max: number = 100): string => `${Math.random() * (max - min) + min}%`,

  // Dynamic height utilities για scroll containers & responsive sizing
  maxHeight: (value: string | number): string => typeof value === 'number' ? `${value}px` : value,

  // ✅ ENTERPRISE FIX: Z-index utilities για ComboBox.tsx
  zIndex: {
    dropdown: 'z-50',
    modal: 'z-[1000]',
    tooltip: 'z-[2000]',
  },

  // Dynamic positioning utilities για absolute/relative positioning
  position: (top: string, left: string): { top: string; left: string } => ({ top, left }),

  // Position preset patterns για common use cases
  positionPresets: {
    centerAbsolute: { top: '50%', left: '50%' },
    topLeft: { top: '0', left: '0' },
    topRight: { top: '0', right: '0' },
    bottomLeft: { bottom: '0', left: '0' },
    bottomRight: { bottom: '0', right: '0' },
  },

  // ✅ ENTERPRISE: Centralized dropdown positioning system (NO MORE INLINE STYLES)
  // 🏢 Z-INDEX VALUES: Use CSS variables from design-tokens.json (--z-index-dropdown = 1000)
  dropdown: {
    // CSS Variables-based positioning (NO inline styles)
    // NOTE: z-index parameter kept for legacy compatibility but defaults to enterprise value
    setCSSPositioning: (position: { top: number; left: number; width: number }, zIndexValue: number = 1000) => {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.style.setProperty('--dropdown-top', `${position.top}px`);
        root.style.setProperty('--dropdown-left', `${position.left}px`);
        root.style.setProperty('--dropdown-width', `${position.width}px`);
        // 🏢 ENTERPRISE: Prefer CSS variable, fallback to parameter
        root.style.setProperty('--dropdown-z-index', `${zIndexValue}`);
      }
    },

    // CSS Classes που χρησιμοποιούν τα CSS variables
    getDropdownClasses: (theme: 'default' | 'dark' | 'modal' = 'default') => {
      const baseClasses = 'fixed pointer-events-auto';
      const positionClasses = '[top:var(--dropdown-top)] [left:var(--dropdown-left)] [width:var(--dropdown-width)] [z-index:var(--dropdown-z-index)]';

      const themeClasses = {
        default: 'bg-popover text-popover-foreground border border-border',
        dark: 'bg-background text-foreground border border-border',
        modal: 'bg-popover text-popover-foreground border border-border shadow-lg'
      };

      return `${baseClasses} ${positionClasses} ${themeClasses[theme]}`;
    },

    // Legacy support - ΘΑ ΔΙΑΓΡΑΦΕΙ σε επόμενη φάση
    // 🏢 ENTERPRISE: Default z-index updated to 1000 (from design-tokens.json)
    portal: (position: { top: number; left: number; width: number }, zIndexValue: number = 1000) => ({
      position: 'fixed' as const,
      top: `${position.top}px`,
      left: `${position.left}px`,
      width: `${position.width}px`,
      zIndex: zIndexValue,
      // ⚠️ DEPRECATED: Χρησιμοποίησε setCSSPositioning + getDropdownClasses
    }),
  },

  // CSS Custom Properties utilities για geo-canvas design system compatibility
  cssVars: {
    // Color utilities
    borderColor: (focused: boolean) => focused ? 'var(--color-border-focus)' : 'var(--color-border-primary)',
    textColor: (variant: 'primary' | 'secondary' | 'tertiary') => `var(--color-text-${variant})`,
    backgroundColor: (variant: 'primary' | 'secondary' | 'surface') => `var(--color-bg-${variant})`,

    // Spacing utilities
    spacing: (size: number | string) => `var(--spacing-${size})`,
    marginBottom: (size: number | string) => ({ marginBottom: `var(--spacing-${size})` }),
    padding: (vertical: number | string, horizontal?: number | string) =>
      horizontal ? `var(--spacing-${vertical}) var(--spacing-${horizontal})` : `var(--spacing-${vertical})`,

    // Shadow utilities
    boxShadow: (focused: boolean) => focused ? 'var(--shadow-focus)' : 'none',

    // Border utilities
    border: (variant: 'primary' | 'secondary' = 'primary') => `1px solid var(--color-border-${variant})`,
    borderRadius: (size: 'sm' | 'md' | 'lg' = 'sm') => `var(--radius-${size})`,

    // Typography utilities
    fontSize: (size: string | number) => typeof size === 'string' ? size : `${size}px`,

    // Empty state typography patterns
    emptyState: {
      icon: { fontSize: '48px', marginBottom: 'var(--spacing-2)' },
      title: { fontSize: '16px', marginBottom: 'var(--spacing-1)' },
      subtitle: { fontSize: '14px' },
    },

    // UI help text patterns
    helpText: {
      small: { fontSize: '12px', opacity: 0.8 },
      muted: { fontSize: '11px', color: 'var(--color-text-tertiary)' },
    },

    // Text styling utilities για preview buttons
    textStyle: {
      bold: { fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none' },
      italic: { fontWeight: 'normal', fontStyle: 'italic', textDecoration: 'none' },
      underline: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'underline' },
      strikethrough: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'line-through' },
      normal: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' },

      // Typography effects για technical notation
      superscript: { fontSize: '60%', verticalAlign: 'super' as const },
      subscript: { fontSize: '60%', verticalAlign: 'sub' as const },

      // Dynamic style based on button type
      forButton: (styleKey: string) => ({
        fontWeight: styleKey === 'isBold' ? 'bold' : 'normal',
        fontStyle: styleKey === 'isItalic' ? 'italic' : 'normal',
        textDecoration:
          styleKey === 'isUnderline' ? 'underline' :
          styleKey === 'isStrikethrough' ? 'line-through' : 'none'
      }),
    },

    // Flex layout utilities με CSS custom properties
    flex: {
      column: (gap?: number | string) => ({
        display: 'flex',
        flexDirection: 'column' as const,
        gap: gap ? `var(--spacing-${gap})` : undefined,
      }),
      row: (gap?: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: gap ? `var(--spacing-${gap})` : undefined,
      }),
      columnGap: (gap: number | string) => ({
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `var(--spacing-${gap})`,
      }),
      rowGap: (gap: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: `var(--spacing-${gap})`,
      }),
      // Dynamic flex basis for fixed-width flex items (replaces inline flex: '0 0 Npx')
      fixedWidth: (width: number) => ({
        flex: `0 0 ${width}px`,
      }),
      // Interactive label pattern for form controls
      labelRow: (gap: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: `var(--spacing-${gap})`,
        fontSize: '12px',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }),
    },

    // Layout utilities για common patterns
    fullWidth: { width: '100%' },
    contentContainer: {
      padding: 'var(--spacing-4)',
      overflowY: 'auto' as const,
      flex: 1
    },

    // Debug/Calibration overlays enterprise patterns
    debugPanel: {
      base: {
        minWidth: 380,
        maxWidth: 450,
        maxHeight: '90vh',
        overflowY: 'auto' as const
      },
      tooltip: {
        position: 'absolute' as const,
        top: 20,
        left: -10,
        fontSize: 10,
        color: 'white',
        background: 'rgba(0,0,0,0.8)',
        padding: '1px 4px',
        borderRadius: 2,
        whiteSpace: 'nowrap' as const
      }
    },

    // Test components styling (temporary utilities)
    testContainer: {
      padding: 'var(--spacing-5)',
      border: '1px solid var(--color-border-secondary)',
      margin: 'var(--spacing-2)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--color-bg-secondary)'
    },

    // Debug floating panels
    // 🏢 ENTERPRISE: Uses centralized zIndex.tooltip for debug overlays
    debugFloat: {
      main: {
        position: 'fixed' as const,
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: 'var(--spacing-2)',
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        fontSize: '12px',
        borderRadius: 'var(--radius-sm)'
      },
      button: {
        margin: 'var(--spacing-1)',
        padding: 'var(--spacing-1)',
        fontSize: '10px',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer'
      }
    },

    // Interactive elements patterns
    interactive: {
      auto: { pointerEvents: 'auto' as const },
      none: { pointerEvents: 'none' as const },
      minHeight: (height: string | number) => ({
        minHeight: typeof height === 'number' ? `${height}px` : height
      }),
      maxHeight: (height: string | number) => ({
        maxHeight: typeof height === 'number' ? `${height}px` : height
      }),
      // Combined min and max height utility (replaces inline minHeight + maxHeight patterns)
      heightRange: (minHeight: string | number, maxHeight: string | number) => ({
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
      })
    },
    inputBase: {
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    },

    // Transform utilities
    transform: {
      centerY: 'translateY(-50%)',
      centerX: 'translateX(-50%)',
      center: 'translate(-50%, -50%)',
    },

    // Common positioning patterns με CSS vars
    absoluteCenter: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    },

    absoluteCenterY: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    },
  },

  // DXF-specific utilities για cursor, crosshair, και settings components
  dxf: {
    // Crosshair line utilities
    crosshairLine: {
      solid: (width: number, color: string) => ({
        height: `${width}px`,
        backgroundColor: color,
      }),

      dashed: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right, ${color} 0, ${color} ${width * 6}px, transparent ${width * 6}px, transparent ${width * 12}px)`,
      }),

      dotted: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right, ${color} 0, ${color} ${width}px, transparent ${width}px, transparent ${width * 8}px)`,
      }),

      dashDot: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right,
          ${color} 0, ${color} ${width * 6}px,
          transparent ${width * 6}px, transparent ${width * 8}px,
          ${color} ${width * 8}px, ${color} ${width * 10}px,
          transparent ${width * 10}px, transparent ${width * 18}px)`,
      }),
    },

    // Dynamic dimension utilities για DXF settings
    dimensions: {
      lineWidth: (width: number) => ({ height: `${width}px` }),
      dynamicHeight: (value: number, unit: 'px' | '%' = 'px') => ({ height: `${value}${unit}` }),
      dynamicWidth: (value: number, unit: 'px' | '%' = 'px') => ({ width: `${value}${unit}` }),
    },

    // Color utilities για dynamic cursor colors
    colors: {
      backgroundColor: (color: string) => ({ backgroundColor: color }),
      borderColor: (color: string) => ({ borderColor: color }),
      color: (color: string) => ({ color }),
    },

    // Composite utilities για common DXF patterns
    composite: {
      coloredBar: (height: number, color: string) => ({
        height: `${height}px`,
        backgroundColor: color,
      }),
    },

    // Color swatch utilities για palette systems
    swatch: {
      square: (size: number, color: string) => ({
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
      }),
      withDimensions: (width: number, height: number, color: string) => ({
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: color,
      }),
      withOpacity: (color: string, opacity: number = 1) => ({
        backgroundColor: color,
        opacity,
      }),
    },

    // Grid utilities για color palette layouts
    grid: {
      swatchGrid: (columns: number, swatchSize: number) => ({
        gridTemplateColumns: `repeat(${columns}, ${swatchSize}px)`,
      }),
    },

    // Line preview utilities για style visualization
    linePreview: {
      withHeight: (height: number | string, background: string) => ({
        height: typeof height === 'number' ? `${height}px` : height,
        background,
      }),
      thin: (background: string) => ({
        height: '2px',
        background,
      }),
    },

    // Canvas utilities για DXF viewport styling
    canvas: {
      fullSize: {
        display: 'block' as const,
        width: '100%',
        height: '100%',
      },
      interactive: {
        display: 'block' as const,
        width: '100%',
        height: '100%',
        touchAction: 'none' as const,
      },
      withBackground: (backgroundColor: string) => ({
        display: 'block' as const,
        width: '100%',
        height: '100%',
        backgroundColor,
      }),
      overlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        pointerEvents: 'none' as const,
      },
    },

    // Cursor utilities για DXF interaction modes
    cursor: {
      none: { cursor: 'none' as const },
      crosshair: { cursor: 'crosshair' as const },
      pointer: { cursor: 'pointer' as const },
      grab: { cursor: 'grab' as const },
      grabbing: { cursor: 'grabbing' as const },
      move: { cursor: 'move' as const },
      default: { cursor: 'default' as const },
    },

    // Dynamic positioning utilities για calibration overlays
    positioning: {
      absoluteAt: (x: number, y: number, width: number = 16, height: number = 16) => ({
        position: 'absolute' as const,
        left: `${x - width / 2}px`,
        top: `${y - height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
      }),
      absoluteTopLeft: (x: number, y: number) => ({
        position: 'absolute' as const,
        left: `${x}px`,
        top: `${y}px`,
      }),
      tooltip: (x: number, y: number, offsetX: number = 15, offsetY: number = -35) => ({
        position: 'absolute' as const,
        left: `${x + offsetX}px`,
        top: `${y + offsetY}px`,
      }),

      // ✅ ENTERPRISE FIX: Status bar overlay positioning για ColorManager.tsx
      statusBarOverlays: {
        colorManagerContainer: (x: number, y: number) => ({
          position: 'absolute' as const,
          left: `${x}px`,
          top: `${y}px`,
          zIndex: zIndex.dropdown, // Enterprise: centralized z-index
        }),
      },
    },

    // Debugging utilities για calibration και testing
    debug: {
      testMarker: (x: number, y: number, isSuccess: boolean) => ({
        position: 'absolute' as const,
        left: `${x - 8}px`,
        top: `${y - 8}px`,
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: isSuccess ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)',
        border: '2px solid var(--color-background-primary)',
        boxShadow: `0 0 10px ${isSuccess ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)'}`,
        pointerEvents: 'none' as const,
        animation: 'pulse 2s infinite',
      }),
      tooltip: {
        position: 'absolute' as const,
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        whiteSpace: 'nowrap' as const,
        pointerEvents: 'none' as const,
      },
    },

    // Dropdown utilities για settings components
    // 🏢 ENTERPRISE: Uses centralized zIndex values
    dropdown: {
      content: {
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        position: 'absolute' as const,
        backgroundColor: 'var(--color-background-tertiary)',
        border: '1px solid var(--color-border-secondary)',
        backdropFilter: 'none' as const,
        WebkitBackdropFilter: 'none' as const,
      },
      highZIndex: {
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        position: 'absolute' as const,
      },
    },

    // Animation utilities για interactive elements
    animation: {
      delay: (seconds: number) => ({ animationDelay: `${seconds}s` }),
      duration: (milliseconds: number) => ({ animationDuration: `${milliseconds}ms` }),
      pingWithDelay: (delaySeconds: number) => ({
        animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        animationDelay: `${delaySeconds}s`
      }),
    },

    // Label utilities για forms και controls
    labels: {
      inverse: {
        color: 'var(--color-text-inverse)',
        fontSize: '0.875rem', // sm equivalent
      },
      primary: {
        color: 'var(--color-text-primary)',
        fontSize: '0.875rem',
      },
      small: {
        fontSize: '0.75rem', // xs equivalent
        color: 'var(--color-text-secondary)',
      },
      extraSmall: {
        fontSize: '0.75rem', // xs equivalent
        color: 'var(--color-text-primary)',
      },
    },

    // Dynamic color utilities για enterprise styling patterns
    dynamicColor: {
      text: (color: string): React.CSSProperties => ({ color }),
      background: (color: string): React.CSSProperties => ({ backgroundColor: color }),
      border: (color: string): React.CSSProperties => ({ borderColor: color }),
    },

    // Typography utilities για enterprise components
    typography: {
      alertTitle: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      } as React.CSSProperties,
    },
  },
} as const;
