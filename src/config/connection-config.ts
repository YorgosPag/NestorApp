// ============================================================================
// 🔗 CONNECTION CONFIG - CENTRALIZED DEFAULTS
// ============================================================================
//
// Single source of truth for connection-related defaults.
//
// ==========================================================================

import { colors, borderColors } from '@/styles/design-tokens';
import type { ConnectionType } from '@/types/connections';

/**
 * Connection line colors by type
 * SSoT for all connection visual styling
 * References design-tokens for color consistency
 */
export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  sameBuilding: colors.blue['500'],          // #3b82f6 — blue-500
  sameFloor: borderColors.success.light,     // #10b981 — emerald-500
  related: colors.purple['500'],             // #8b5cf6 — purple-500
  parking: colors.severity.medium.icon,      // #f59e0b — amber-500
} as const;

/** Fallback color for unknown connection types */
export const CONNECTION_FALLBACK_COLOR = colors.gray['500']; // #6b7280

export const CONNECTION_DEFAULTS = {
  propertyGroupColor: colors.blue['500'],
  colors: CONNECTION_COLORS,
  fallbackColor: CONNECTION_FALLBACK_COLOR,
} as const;

export default CONNECTION_DEFAULTS;
