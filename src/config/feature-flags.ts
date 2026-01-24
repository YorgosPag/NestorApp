/**
 * =============================================================================
 * APP-WIDE FEATURE FLAGS
 * =============================================================================
 *
 * Centralized feature toggle configuration for the entire application.
 * Based on DXF Viewer feature-flags.ts pattern.
 *
 * @module config/feature-flags
 * @enterprise ADR-030 - Zero Hardcoded Values
 * @created 2026-01-24
 *
 * 🏢 ENTERPRISE PRINCIPLE: Flags are IMMUTABLE at runtime.
 * No runtime mutation allowed - flags are determined at build time.
 * For dynamic toggles, use Firestore Remote Config with admin-only writes + audit.
 *
 * Usage:
 * ```typescript
 * import { isAppFeatureEnabled } from '@/config/feature-flags';
 *
 * if (isAppFeatureEnabled('UNIT_LINKING')) {
 *   // render unit linking UI
 * }
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AppFeatureFlags {
  /**
   * Unit Linking System (Building/Floor/Parking/Storage)
   * @status ENABLED
   * @see ADR-025 Unit Linking System
   */
  UNIT_LINKING: boolean;

  /**
   * CRM Communications Module
   * @status ENABLED
   */
  CRM_COMMUNICATIONS: boolean;

  /**
   * Grid View for entities (Units, Parking, Storage)
   * @status ENABLED
   */
  ENTITY_GRID_VIEW: boolean;
}

// ============================================================================
// FEATURE FLAGS VALUES (IMMUTABLE AT RUNTIME)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Immutable feature flags - frozen at build time.
 *
 * Object.freeze ensures no runtime mutation is possible.
 * For dynamic feature toggles in production, implement:
 * - Firestore Remote Config with admin-only writes
 * - Or build-time environment variables
 */
export const APP_FEATURE_FLAGS: Readonly<AppFeatureFlags> = Object.freeze({
  /**
   * ✅ ENABLED: Unit Linking System (ΒΗΜΑ 2 Complete - 2026-01-24)
   *
   * Fix Applied:
   * - Converted to draft-based controlled components
   * - Draft state initialized ONCE in useState (no continuous sync)
   * - Removed state mirroring useEffect(() => setState(prop), [prop])
   * - Removed __none__ magic strings - using empty string/undefined
   *
   * Root Cause Analysis (RCA):
   * - ACTUAL: State mirroring anti-pattern causing cascading re-renders
   *   which triggered Radix Select compose-refs ref attach/detach loop.
   * - NOT: Radix peerDeps mismatch. @radix-ui/react-select@2.2.6
   *   peerDependencies include "react": "^16.8 || ^17.0 || ^18.0 || ^19.0"
   *   which covers React 19. See: node_modules/@radix-ui/react-select/package.json
   *
   * @enabled 2026-01-24
   */
  UNIT_LINKING: true,

  /**
   * ✅ CRM Communications - Active
   */
  CRM_COMMUNICATIONS: true,

  /**
   * ✅ Grid View - Active
   */
  ENTITY_GRID_VIEW: true,
});

// ============================================================================
// HELPER FUNCTIONS (READ-ONLY)
// ============================================================================

/**
 * Check if an app-wide feature is enabled
 *
 * @param feature - Feature key from AppFeatureFlags
 * @returns boolean - Whether the feature is enabled
 *
 * @example
 * ```tsx
 * if (isAppFeatureEnabled('UNIT_LINKING')) {
 *   return <BuildingSelectorCard />;
 * }
 * ```
 */
export function isAppFeatureEnabled(feature: keyof AppFeatureFlags): boolean {
  return APP_FEATURE_FLAGS[feature] === true;
}

// ============================================================================
// 🚫 NO RUNTIME MUTATION FUNCTIONS
// ============================================================================
//
// 🏢 ENTERPRISE: Runtime mutation of feature flags is NOT allowed.
//
// Previous anti-pattern (REMOVED):
// - enableAppFeature() / disableAppFeature() allowed runtime mutation
// - This causes non-deterministic behavior in Next.js/React concurrent mode
// - Global mutable singleton = unpredictable state across renders
//
// For dynamic feature toggles, implement one of:
// 1. Firestore Remote Config: /appConfig/featureFlags (admin-only writes + audit)
// 2. Build-time env flags: NEXT_PUBLIC_FEATURE_X in .env
// 3. LaunchDarkly / Firebase Remote Config (enterprise services)
//
// ============================================================================
