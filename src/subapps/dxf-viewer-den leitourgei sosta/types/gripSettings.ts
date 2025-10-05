/**
 * AutoCAD-style Grip Settings
 * Βασισμένο στις AutoCAD system variables: GRIPSIZE, PICKBOX, APERTURE
 */

import type { Point2D } from '../rendering/types/Types';

export interface GripSettings {
  // === AutoCAD Variables ===
  gripSize: number;         // GRIPSIZE: 1-255 DIPs, default 5
  pickBoxSize: number;      // PICKBOX: 0-50 DIPs, default 3  
  apertureSize: number;     // APERTURE: 1-50 px, default 10
  showAperture: boolean;    // APBOX: show/hide osnap aperture
  
  // === Grip Colors (AutoCAD style) ===
  colors: {
    cold: string;           // GRIPCOLOR: unselected (default blue)
    warm: string;           // GRIPHOVER: hover (default orange)
    hot: string;            // GRIPHOT: selected (default red)
    contour: string;        // GRIPCONTOUR: border (default black)
  };
  
  // === Advanced Settings ===
  enabled: boolean;         // Enable/disable grip system
  showGrips: boolean;       // Show/hide grips on selected entities
  multiGripEdit: boolean;   // Allow multi-grip operations
  snapToGrips: boolean;     // Enable snap to grips
  showGripTips: boolean;    // Show grip tooltips
  dpiScale: number;         // DPI scaling factor
  maxGripsPerEntity: number; // Maximum grips per entity (performance)

  // === Display Settings ===
  opacity: number;          // Grip opacity (0.0 - 1.0)
  showMidpoints: boolean;   // Show midpoint grips
  showCenters: boolean;     // Show center grips
  showQuadrants: boolean;   // Show quadrant grips
}

export interface GripState {
  type: 'cold' | 'warm' | 'hot';
  entityId: string;
  gripIndex: number;
  position: Point2D;
  gripType: 'vertex' | 'edge' | 'center' | 'corner';
}

export interface GripInteractionState {
  hovered?: { entityId: string; gripIndex: number };
  active?: { entityId: string; gripIndex: number };
}

// === DEFAULT AUTOCAD-STYLE SETTINGS (International Standards) ===
const defaultGripSettings = {
  gripSize: 5,       // ✅ AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,    // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,  // ✅ AutoCAD APERTURE default: 10 pixels
  showAperture: true, // ✅ AutoCAD APBOX default: enabled

  colors: {
    cold: '#0000FF',     // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',     // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',      // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: '#000000'   // ✅ AutoCAD standard: Black contour
  },
};

export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  ...defaultGripSettings,

  enabled: true,            // ✅ Enable grip system by default
  showGrips: true,          // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση grips
  multiGripEdit: true,      // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση multi grips
  snapToGrips: true,        // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση snap to grips
  showGripTips: false,
  dpiScale: 1.0,
  maxGripsPerEntity: 50,    // ✅ Default maximum grips per entity

  // === Display Settings ===
  opacity: 1.0,             // ✅ Full opacity by default
  showMidpoints: true,      // ✅ Show midpoint grips
  showCenters: true,        // ✅ Show center grips
  showQuadrants: true       // ✅ Show quadrant grips
};

// === VALIDATION ===
export const GRIP_LIMITS = {
  gripSize: { min: 1, max: 255 },
  pickBoxSize: { min: 0, max: 50 },
  apertureSize: { min: 1, max: 50 }
} as const;

export function validateGripSettings(settings: Partial<GripSettings>): GripSettings {
  const result = { ...DEFAULT_GRIP_SETTINGS, ...settings };

  // Clamp values to AutoCAD ranges
  result.gripSize = Math.max(GRIP_LIMITS.gripSize.min,
    Math.min(GRIP_LIMITS.gripSize.max, result.gripSize));
  result.pickBoxSize = Math.max(GRIP_LIMITS.pickBoxSize.min,
    Math.min(GRIP_LIMITS.pickBoxSize.max, result.pickBoxSize));
  result.apertureSize = Math.max(GRIP_LIMITS.apertureSize.min,
    Math.min(GRIP_LIMITS.apertureSize.max, result.apertureSize));

  // Clamp additional settings
  result.opacity = Math.max(0.1, Math.min(1.0, result.opacity));
  result.maxGripsPerEntity = Math.max(10, Math.min(200, result.maxGripsPerEntity));

  return result;
}
