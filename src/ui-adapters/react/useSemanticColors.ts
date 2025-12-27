// ============================================================================
// 🌉 BRIDGE-BASED SEMANTIC COLORS HOOK - Enterprise → shadcn/ui Bridge
// ============================================================================
//
// ✨ Ultra-lightweight React hook - PURE MAPPING FACADE
// 🎯 No logic, no computation, no CSS math - just mapping
// 🌉 Bridges Enterprise Semantic API → shadcn/ui Tailwind classes
//
// Enterprise API → COLOR_BRIDGE → shadcn variables → CSS → UI
// ============================================================================

'use client';

import { useMemo } from 'react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

/**
 * 🌉 BRIDGE-BASED Semantic Colors Hook Interface
 * Ultra-simple API - direct mapping to COLOR_BRIDGE
 */
export interface UseSemanticColorsReturn {
  readonly text: typeof COLOR_BRIDGE.text;
  readonly bg: typeof COLOR_BRIDGE.bg;
  readonly border: typeof COLOR_BRIDGE.border;
  readonly interactive: typeof COLOR_BRIDGE.interactive;

  // Simple utility methods (no complex logic)
  readonly getText: (type: keyof typeof COLOR_BRIDGE.text) => string;
  readonly getBg: (type: keyof typeof COLOR_BRIDGE.bg) => string;
  readonly getBorder: (type: keyof typeof COLOR_BRIDGE.border) => string;
}

/**
 * 🌉 BRIDGE-BASED Semantic Colors Hook
 *
 * ✨ PURE MAPPING FACADE - No logic, no computation
 * 🎯 Direct bridge to COLOR_BRIDGE mappings
 *
 * @returns {UseSemanticColorsReturn} Direct access to color bridge
 */
export function useSemanticColors(): UseSemanticColorsReturn {
  return useMemo(() => ({
    // 🌉 Direct bridge mappings - ZERO LOGIC
    text: COLOR_BRIDGE.text,
    bg: COLOR_BRIDGE.bg,
    border: COLOR_BRIDGE.border,
    interactive: COLOR_BRIDGE.interactive,

    // 🎯 Simple utility methods - PURE MAPPING
    getText: (type) => COLOR_BRIDGE.text[type],
    getBg: (type) => COLOR_BRIDGE.bg[type] || COLOR_BRIDGE.bg.primary,
    getBorder: (type) => COLOR_BRIDGE.border[type] || COLOR_BRIDGE.border.default,
  } as const), []);
}

/**
 * Default export for convenience
 */
export default useSemanticColors;