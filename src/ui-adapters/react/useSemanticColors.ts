// ============================================================================
// 🪝 NEW SEMANTIC COLORS HOOK - Clean React Adapter
// ============================================================================
//
// ✨ Lightweight React hook for semantic colors
// Consumes design system layers and provides Tailwind classes
//
// Enterprise-grade: Clean separation of concerns
// Disposable: Pure consumption layer, no design decisions
//
// ============================================================================

'use client';

import { useMemo } from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { tailwindColorMappings, combineTailwindClasses } from '../tailwind/colors.adapter';

/**
 * Semantic Colors Hook Interface
 * Clean API for consuming semantic colors in React components
 */
export interface UseSemanticColorsReturn {
  readonly text: typeof tailwindColorMappings.text;
  readonly bg: typeof tailwindColorMappings.background;
  readonly border: typeof tailwindColorMappings.border;
  readonly interactive: typeof tailwindColorMappings.interactive;
  readonly status: typeof tailwindColorMappings.status;
  readonly layout: typeof tailwindColorMappings.layout;

  // Utility methods
  readonly getText: (type: keyof typeof tailwindColorMappings.text) => string;
  readonly getBg: (type: keyof typeof tailwindColorMappings.background) => string;
  readonly getBorder: (type: keyof typeof tailwindColorMappings.border) => string;
  readonly getStatusColor: (status: keyof typeof tailwindColorMappings.status, type: 'text' | 'bg' | 'border' | 'combined') => string;
  readonly createCustomPattern: (classes: string[]) => string;
}

/**
 * New Semantic Colors Hook - Enterprise Architecture
 *
 * Clean, lightweight hook that consumes design system layers
 * and provides type-safe Tailwind class access
 *
 * @returns {UseSemanticColorsReturn} Semantic color patterns with utility methods
 */
export function useSemanticColors(): UseSemanticColorsReturn {
  // Integration with existing border tokens system
  const { quick } = useBorderTokens();

  return useMemo(() => ({
    // Direct access to color mappings
    text: tailwindColorMappings.text,
    bg: tailwindColorMappings.background,
    border: tailwindColorMappings.border,
    interactive: tailwindColorMappings.interactive,
    status: tailwindColorMappings.status,
    layout: tailwindColorMappings.layout,

    // Utility methods for dynamic access
    getText: (type) => tailwindColorMappings.text[type],

    getBg: (type) => {
      if (type in tailwindColorMappings.background) {
        return tailwindColorMappings.background[type as keyof typeof tailwindColorMappings.background];
      }
      return tailwindColorMappings.background.primary;
    },

    getBorder: (type) => tailwindColorMappings.border[type],

    getStatusColor: (status, colorType) => {
      const statusPattern = tailwindColorMappings.status[status];
      return statusPattern[colorType];
    },

    createCustomPattern: (classes) => combineTailwindClasses(...classes),

    // Legacy compatibility helpers (temporarily kept for smooth migration)
    patterns: {
      card: {
        standard: combineTailwindClasses(
          tailwindColorMappings.background.primary,
          quick.card
        ),
        hover: combineTailwindClasses(
          tailwindColorMappings.background.primary,
          quick.card,
          tailwindColorMappings.interactive.hover.background.light,
          'transition-colors'
        ),
        selected: combineTailwindClasses(
          tailwindColorMappings.background.info,
          quick.card,
          tailwindColorMappings.border.info
        ),
      },
      alert: {
        success: combineTailwindClasses(
          tailwindColorMappings.background.success,
          quick.table,
          tailwindColorMappings.border.success,
          tailwindColorMappings.text.success.replace('text-green-600', 'text-green-800'),
          'p-4'
        ),
        error: combineTailwindClasses(
          tailwindColorMappings.background.error,
          quick.table,
          tailwindColorMappings.border.error,
          tailwindColorMappings.text.error.replace('text-red-600', 'text-red-800'),
          'p-4'
        ),
        warning: combineTailwindClasses(
          tailwindColorMappings.background.warning,
          quick.table,
          tailwindColorMappings.border.warning,
          tailwindColorMappings.text.warning.replace('text-yellow-600', 'text-yellow-800'),
          'p-4'
        ),
        info: combineTailwindClasses(
          tailwindColorMappings.background.info,
          quick.table,
          tailwindColorMappings.border.info,
          tailwindColorMappings.text.info.replace('text-blue-600', 'text-blue-800'),
          'p-4'
        ),
      },
      badge: {
        success: combineTailwindClasses(
          'bg-green-100 text-green-800',
          quick.input,
          'border-green-300 px-2 py-1 text-sm'
        ),
        error: combineTailwindClasses(
          'bg-red-100 text-red-800',
          quick.input,
          'border-red-300 px-2 py-1 text-sm'
        ),
        warning: combineTailwindClasses(
          'bg-yellow-100 text-yellow-800',
          quick.input,
          'border-yellow-300 px-2 py-1 text-sm'
        ),
        info: combineTailwindClasses(
          'bg-blue-100 text-blue-800',
          quick.input,
          'border-blue-300 px-2 py-1 text-sm'
        ),
      },
    },

  } as const), [quick]);
}

/**
 * Default export for convenience
 */
export default useSemanticColors;