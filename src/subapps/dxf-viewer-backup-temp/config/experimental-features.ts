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

  // 🎯 Professional CAD Layout Debugging System
  LAYOUT_DEBUG_SYSTEM: true, // Toggle for precision UI debugging tools
} as const;

export function isFeatureEnabled(feature: keyof typeof EXPERIMENTAL_FEATURES): boolean {
  return EXPERIMENTAL_FEATURES[feature] === true;
}