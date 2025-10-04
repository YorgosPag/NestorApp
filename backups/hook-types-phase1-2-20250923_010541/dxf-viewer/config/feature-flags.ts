/**
 * FEATURE FLAGS
 * Centralized feature toggle configuration
 */

export interface FeatureFlags {
  // Level management system
  ENABLE_LEVELS_SYSTEM: boolean;
  
  // Layer systems
  ENABLE_DXF_LAYERS: boolean;
  
  // Unified Grips System (UGS) for Layering mode
  ENABLE_UGS_FOR_LAYERS: boolean;
  
  // Unified Drawing Engine
  USE_UNIFIED_DRAWING_ENGINE: boolean;
  
  // Future features
  ENABLE_ADVANCED_TOOLS: boolean;
}

export const FEATURE_FLAGS: FeatureFlags = {
  // ✅ DXF Layers είναι πάντα ενεργό
  ENABLE_DXF_LAYERS: true,
  
  // ✅ LevelsSystem ενεργοποιημένο και πάλι
  ENABLE_LEVELS_SYSTEM: true,
  
  // ✅ UGS για Layering - DXF-style grips (πορτοκαλί/κόκκινο, dashed λευκές γραμμές)
  ENABLE_UGS_FOR_LAYERS: true,
  
  // ✅ Unified Drawing Engine - ενοποιημένο από το featureFlags.ts
  USE_UNIFIED_DRAWING_ENGINE: true,
  
  // Future features
  ENABLE_ADVANCED_TOOLS: true,
};

// Helper functions
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return FEATURE_FLAGS[feature];
};

export const enableFeature = (feature: keyof FeatureFlags): void => {
  (FEATURE_FLAGS as any)[feature] = true;
};

export const disableFeature = (feature: keyof FeatureFlags): void => {
  (FEATURE_FLAGS as any)[feature] = false;
};