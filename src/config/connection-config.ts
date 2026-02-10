// ============================================================================
// 🔗 CONNECTION CONFIG - CENTRALIZED DEFAULTS
// ============================================================================
//
// Single source of truth for connection-related defaults.
//
// ==========================================================================

import { designTokens } from '@/styles/design-tokens';

export const CONNECTION_DEFAULTS = {
  propertyGroupColor: designTokens.colors.blue['500'],
} as const;

export default CONNECTION_DEFAULTS;
