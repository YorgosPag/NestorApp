/**
 * Experimental Features Configuration
 * Controls optional/experimental features in DXF Viewer
 */

export const EXPERIMENTAL_FEATURES = {
  // Collaboration features (currently disabled)
  COLLABORATION_OVERLAY: false,

  // Legacy overlay integration system (deprecated)
  DXF_CANVAS_OVERLAY_INTEGRATION: false,

  // Future features can be added here
  ADVANCED_SNAPPING: true,
  MULTI_LAYER_GRIPS: true,

  // 🆕 PHASE 4: Enterprise Settings System - Shadow Mode ENABLED
  // Enterprise provider validates data while old provider renders UI
  ENTERPRISE_SETTINGS_SHADOW_MODE: true,

  // 🆕 PHASE 6: Production Mode (Future - After Conference)
  // Enterprise provider as primary - requires full migration
  ENTERPRISE_SETTINGS_PRODUCTION_MODE: false,

  // 🆕 PORTS & ADAPTERS: Store Sync with Dependency Injection
  // Enables decoupled store synchronization via ports
  ENABLE_SETTINGS_SYNC: true,

  // Layout Debug System
  LAYOUT_DEBUG_SYSTEM: false,

  // 🏢 ENTERPRISE (2027-01-27): Unified Drawing Engine
  // Enables unified drawing engine for overlay creation
  USE_UNIFIED_DRAWING_ENGINE: true,
} as const;

export function isFeatureEnabled(feature: keyof typeof EXPERIMENTAL_FEATURES): boolean {
  return EXPERIMENTAL_FEATURES[feature] === true;
}