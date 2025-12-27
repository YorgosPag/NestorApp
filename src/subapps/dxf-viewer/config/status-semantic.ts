/**
 * 🏢 ENTERPRISE STATUS → SEMANTIC MAPPING SYSTEM
 *
 * Pure domain logic που maps PropertyStatus σε semantic intent tokens
 * ZERO UI dependencies, ZERO Tailwind, ZERO design tokens
 *
 * Single source of truth για semantic categorization
 * Used by adapter layer για runtime theming
 */

import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';

// ============================================================================
// SEMANTIC INTENT TYPES (Pure, Framework-Agnostic)
// ============================================================================

export type SemanticIntent =
  | 'success'    // Available, positive states
  | 'warning'    // Conditional, attention states
  | 'error'      // Unavailable, negative states
  | 'info'       // Active, informational states
  | 'muted';     // Neutral, inactive states

// ============================================================================
// DOMAIN → SEMANTIC MAPPING (Enterprise Single Source of Truth)
// ============================================================================

export const STATUS_TO_SEMANTIC: Record<PropertyStatus, SemanticIntent> = {
  // 🟢 SUCCESS - Available, positive outcomes
  'for-sale': 'success',
  'coming-soon': 'success',

  // 🟡 WARNING - Conditional, attention required
  'reserved': 'warning',
  'under-negotiation': 'warning',

  // 🔴 ERROR - Unavailable, final negative states
  'sold': 'error',
  'rented': 'error',
  'unavailable': 'error',

  // 🔵 INFO - Active, informational
  'for-rent': 'info',
  'landowner': 'info',

  // ⚪ MUTED - Neutral, inactive
  'off-market': 'muted',
} as const;

// ============================================================================
// ENTERPRISE VALIDATION & UTILITIES
// ============================================================================

/**
 * Get semantic intent για any PropertyStatus
 * Type-safe με exhaustive checking
 */
export function getSemanticIntent(status: PropertyStatus): SemanticIntent {
  const semantic = STATUS_TO_SEMANTIC[status];
  if (!semantic) {
    throw new Error(`Unmapped PropertyStatus: ${status}`);
  }
  return semantic;
}

/**
 * Type guard για semantic intent validation
 */
export function isValidSemanticIntent(intent: string): intent is SemanticIntent {
  return ['success', 'warning', 'error', 'info', 'muted'].includes(intent);
}