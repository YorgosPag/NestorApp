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

  // 🆕 PHASE 3: Enterprise Settings System (Migration Phases 1-8)
  // Set to true to enable enterprise provider in shadow mode (validation only)
  ENTERPRISE_SETTINGS_SHADOW_MODE: false,

  // 🆕 PHASE 6: Enable enterprise provider as primary (replaces old provider)
  ENTERPRISE_SETTINGS_PRODUCTION_MODE: false,
} as const;

export function isFeatureEnabled(feature: keyof typeof EXPERIMENTAL_FEATURES): boolean {
  return EXPERIMENTAL_FEATURES[feature] === true;
}