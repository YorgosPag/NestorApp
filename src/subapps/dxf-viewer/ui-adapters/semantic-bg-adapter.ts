/**
 * 🏢 ENTERPRISE SEMANTIC → UI BACKGROUND ADAPTER
 *
 * Pure boundary layer που μεταφράζει semantic intent → UI background classes
 * ZERO domain knowledge, ZERO business logic
 *
 * Adapter = boundary μεταξύ domain και UI
 * Ξέρει μόνο: SemanticIntent + useSemanticColors → CSS classes
 */

import type { SemanticIntent } from '../config/status-semantic';
import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// SEMANTIC → UI MAPPING (Pure Translation Layer)
// ============================================================================

/**
 * Semantic background adapter mapping
 * Maps semantic intent → background class function
 * ZERO business logic, ZERO fallbacks, ZERO domain knowledge
 */
export const semanticBgAdapter: Record<
  SemanticIntent,
  (colors: UseSemanticColorsReturn) => string
> = {
  success: (c) => c.bg.success,
  warning: (c) => c.bg.warning,
  error:   (c) => c.bg.error,
  info:    (c) => c.bg.info,
  muted:   (c) => c.bg.muted,
};

// ============================================================================
// ENTERPRISE HELPER (Safe API)
// ============================================================================

/**
 * Get background class για semantic intent
 * Type-safe runtime translation
 * Compile-time exhaustive checking
 */
export function getSemanticBgClass(
  intent: SemanticIntent,
  colors: UseSemanticColorsReturn
): string {
  return semanticBgAdapter[intent](colors);
}