/**
 * @file Legacy Types - DEPRECATED Façade
 * @module settings/core/types
 *
 * ⚠️ DEPRECATED - This file is a façade for backward compatibility.
 *
 * @deprecated Since 2026-01-01. Use `settings-core/types` instead.
 *
 * @example
 * ```typescript
 * // OLD (deprecated):
 * import type { LineSettings } from '../settings/core/types';
 *
 * // NEW (recommended):
 * import type { LineSettings } from '../settings-core/types';
 * ```
 *
 * This file re-exports from the canonical location to maintain
 * backward compatibility during the migration period.
 *
 * @see settings-core/types for the canonical type definitions
 * @version 2.0.0 (Façade)
 * @since 2026-01-01
 */

// ============================================================================
// RE-EXPORTS FROM CANONICAL SOURCE
// ============================================================================

/**
 * @deprecated Use import from 'settings-core/types' instead
 */
export * from '../../settings-core/types';

// ============================================================================
// DEPRECATION NOTICE
// ============================================================================

// This warning will appear in development console when this module is imported
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn(
    '[DEPRECATED] Importing from "settings/core/types" is deprecated. ' +
    'Please update imports to use "settings-core/types" instead.'
  );
}
