/**
 * Brand & Map Design Tokens
 * Extracted from design-tokens.ts — brandClasses, getBrandClass, mapInteractionTokens,
 * mapControlPointTokens, DESIGN_TOKENS_V2_INFO, bg
 * Config/data file (no line limit)
 */

import * as React from 'react';
import { colors } from './foundations';
import { zIndex } from './layout';

export const brandClasses = {
  // Primary brand colors
  primary: {
    text: 'text-blue-500',        // colors.blue[500]
    bg: 'bg-blue-50',            // light background
    bgDark: 'bg-blue-500',       // solid background
    border: 'border-blue-200',    // subtle border
    ring: 'ring-blue-100',       // focus ring

    // Interactive states
    hover: {
      text: 'hover:text-blue-600',
      bg: 'hover:bg-blue-100',
      border: 'hover:border-blue-500',
    },

    // Badge styles
    badge: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',

    // Focus states
    focus: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  },

  // Loading/spinner colors
  loading: {
    spinner: 'border-blue-600',
    spinnerLight: 'border-blue-400',
  },

  // Status indicators
  info: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',

    // Card styles
    card: 'bg-blue-50 rounded-lg p-4 border-2 border-blue-200',
    title: 'text-blue-700',
  },

  // Interactive elements
  interactive: {
    button: 'bg-blue-600 text-white font-medium',
    buttonHover: 'hover:bg-blue-700',
    link: 'text-blue-600 hover:text-blue-700',
  },

  // Effect classes
  effects: {
    shadow: 'hover:shadow-blue-500/20',
    borderGlow: 'hover:border-blue-500/50',
    scale: 'hover:scale-110',
  }
} as const;

/**
 * 🔧 Helper function να get brand classes dynamically
 * ✅ ENTERPRISE: No 'any' - uses proper type narrowing
 */
export const getBrandClass = (category: keyof typeof brandClasses, variant?: string): string => {
  const categoryClasses = brandClasses[category];

  if (variant && typeof categoryClasses === 'object' && variant in categoryClasses) {
    // ✅ ENTERPRISE: Use Record<string, unknown> instead of 'any' for type-safe access
    const value = (categoryClasses as Record<string, unknown>)[variant];
    return typeof value === 'string' ? value : '';
  }

  return typeof categoryClasses === 'string' ? categoryClasses : '';
};

// ============================================================================
// MAP INTERACTION TOKENS - GEO-CANVAS SYSTEM
// ============================================================================

/**
 * Map Interaction Tokens για geo-canvas interactive map system
 * Enterprise-grade styling για geographical interfaces
 */
export const mapInteractionTokens = {
  containers: {
    fullscreen: {
      position: 'absolute' as const,
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: colors.background.primary,
      overflow: 'hidden'
    },
    viewport: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }
  },
  getMapCursor: (isPickingCoordinates: boolean, systemIsDrawing: boolean): string => {
    if (isPickingCoordinates) return 'crosshair';
    if (systemIsDrawing) return 'crosshair';
    return 'default';
  }
} as const;

/**
 * Map Control Point Tokens για interactive polygon editing
 * Professional control point styling με state management
 */
export const mapControlPointTokens = {
  base: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: `2px solid ${colors.primary[500]}`,
    backgroundColor: colors.background.primary,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    position: 'absolute' as const
  },
  states: {
    default: {
      zIndex: zIndex.docked,
      transform: 'scale(1)',
      opacity: 0.8
    },
    selected: {
      zIndex: zIndex.docked + 1,
      transform: 'scale(1.2)',
      backgroundColor: colors.primary[500],
      boxShadow: `0 0 8px ${colors.primary[500]}`,
      opacity: 1
    },
    highlight: {
      zIndex: zIndex.docked + 2,
      transform: 'scale(1.1)',
      borderColor: colors.blue["600"],
      backgroundColor: colors.blue["300"],
      opacity: 1
    },
    complete: {
      borderColor: colors.green["500"],
      backgroundColor: colors.green["300"]
    }
  },
  getControlPointStyle: (
    isSelected: boolean,
    shouldHighlight: boolean,
    isComplete: boolean
  ): React.CSSProperties => {
    const base = mapControlPointTokens.base;
    let state: React.CSSProperties = mapControlPointTokens.states.default as React.CSSProperties;

    if (isComplete) {
      state = { ...state, ...(mapControlPointTokens.states.complete as React.CSSProperties) };
    }
    if (shouldHighlight) {
      state = { ...state, ...(mapControlPointTokens.states.highlight as React.CSSProperties) };
    }
    if (isSelected) {
      state = { ...state, ...(mapControlPointTokens.states.selected as React.CSSProperties) };
    }

    return { ...base, ...state };
  }
};

// ============================================================================
// DESIGN TOKENS V2 INFO
// ============================================================================

export const DESIGN_TOKENS_V2_INFO = {
  version: '2.1.0',
  description: 'Enterprise-class modular design tokens με performance optimization support',
  migrationGuide: 'See ./design-tokens/index.ts for full API documentation',
  modules: [
    'semantic/alert-tokens.ts - Alert severity, status, AutoSave indicators',
    'components/dashboard-tokens.ts - Dashboard layouts, metrics, charts',
    'components/map-tokens.ts - Map interfaces, polygons, drawing tools',
    'components/dialog-tokens.ts - Modals, forms, wizards, steps',
    'performance/performance-tokens.ts - Virtualized tables, metrics, analytics'
  ]
} as const;

// ============================================================================
// 🎨 TAILWIND CSS CLASS MAPPINGS - ENTERPRISE SYSTEM
// ============================================================================

/**
 * ENTERPRISE BACKGROUND UTILITY CLASSES
 * Maps semantic background concepts to Tailwind CSS classes
 * Used throughout DXF Viewer for consistent background styling
 */
export const bg = {
  // Core backgrounds
  primary: 'bg-background',
  secondary: 'bg-muted',
  card: 'bg-card',
  surface: 'bg-card',
  muted: 'bg-muted',
  tertiary: 'bg-slate-100',
  backgroundSecondary: 'bg-muted',

  // Skeleton loading states
  skeleton: 'bg-muted',

  // Accent backgrounds
  accent: 'bg-accent',

  // Selection states
  selection: 'bg-blue-100',

  // Status backgrounds
  success: 'bg-green-100',
  successHover: 'bg-green-200',
  warning: 'bg-yellow-100',
  error: 'bg-red-100',
  info: 'bg-blue-100',

  // Interactive states
  hover: 'bg-accent/10',

  // Overlay backgrounds
  overlay: 'bg-black/50',

  // Specialty colors
  violet: 'bg-violet-100',
  pink: 'bg-pink-100',
  indigo: 'bg-indigo-100',
  cyan: 'bg-cyan-100',
  emerald: 'bg-emerald-100',
  amber: 'bg-amber-100',
  lime: 'bg-lime-100',
  rose: 'bg-rose-100',
  sky: 'bg-sky-100',
  orange: 'bg-orange-100',
  teal: 'bg-teal-100',
  purple: 'bg-purple-100',
  yellow: 'bg-yellow-100',
  green: 'bg-green-100',
  blue: 'bg-blue-100',
  red: 'bg-red-100',
  gray: 'bg-gray-100',
  slate: 'bg-slate-100',
  stone: 'bg-stone-100',
  neutral: 'bg-neutral-100',
  zinc: 'bg-zinc-100',
  magenta: 'bg-pink-100'
} as const;
