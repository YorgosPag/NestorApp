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
  readonly ring: typeof COLOR_BRIDGE.ring;
  readonly interactive: typeof COLOR_BRIDGE.interactive;
  readonly gradients: typeof COLOR_BRIDGE.gradients;

  // Simple utility methods (no complex logic)
  readonly getText: (type: keyof typeof COLOR_BRIDGE.text) => string;
  readonly getBg: (type: keyof typeof COLOR_BRIDGE.bg) => string;
  readonly getBorder: (type: keyof typeof COLOR_BRIDGE.border) => string;
  readonly getRing: (type: keyof typeof COLOR_BRIDGE.ring) => string;
  readonly getGradient: (type: keyof typeof COLOR_BRIDGE.gradients) => string;
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
    ring: COLOR_BRIDGE.ring,
    interactive: COLOR_BRIDGE.interactive,
    gradients: COLOR_BRIDGE.gradients,

    // 🎯 Simple utility methods - PURE MAPPING
    getText: (type) => COLOR_BRIDGE.text[type],
    getBg: (type) => COLOR_BRIDGE.bg[type] || COLOR_BRIDGE.bg.primary,
    getBorder: (type) => COLOR_BRIDGE.border[type] || COLOR_BRIDGE.border.default,
    getRing: (type) => COLOR_BRIDGE.ring[type] || COLOR_BRIDGE.ring.default,
    getGradient: (type) => COLOR_BRIDGE.gradients[type] || COLOR_BRIDGE.gradients.neutralSubtle,
  } as const), []);
}

/**
 * Default export for convenience
 */
export default useSemanticColors;