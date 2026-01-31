/**
 * AutoCAD-style Grip Settings
 * Βασισμένο στις AutoCAD system variables: GRIPSIZE, PICKBOX, APERTURE
 */

import type { Point2D } from '../rendering/types/Types';
import { UI_COLORS } from '../config/color-config';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../rendering/entities/shared/geometry-utils';

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
    cold: UI_COLORS.SNAP_CENTER,     // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: UI_COLORS.SNAP_INTERSECTION,     // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: UI_COLORS.SNAP_ENDPOINT,      // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: UI_COLORS.BLACK   // ✅ AutoCAD standard: Black contour
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

  // 🏢 ADR-071: Clamp values to AutoCAD ranges using centralized clamp
  result.gripSize = clamp(result.gripSize, GRIP_LIMITS.gripSize.min, GRIP_LIMITS.gripSize.max);
  result.pickBoxSize = clamp(result.pickBoxSize, GRIP_LIMITS.pickBoxSize.min, GRIP_LIMITS.pickBoxSize.max);
  result.apertureSize = clamp(result.apertureSize, GRIP_LIMITS.apertureSize.min, GRIP_LIMITS.apertureSize.max);

  // 🏢 ADR-071: Clamp additional settings using centralized clamp
  result.opacity = clamp(result.opacity, 0.1, 1.0);
  result.maxGripsPerEntity = clamp(result.maxGripsPerEntity, 10, 200);

  return result;
}
