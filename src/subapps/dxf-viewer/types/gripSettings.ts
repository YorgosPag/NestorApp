/**
 * AutoCAD-style Grip Settings
 * Βασισμένο στις AutoCAD system variables: GRIPSIZE, PICKBOX, APERTURE
 */

import type { Point2D } from '../rendering/types/Types';
import { UI_COLORS, GRIP_COLD_COLOR, GRIP_WARM_COLOR, GRIP_HOT_COLOR, GRIP_CONTOUR_COLOR } from '../config/color-config';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../rendering/entities/shared/geometry-utils';
// 🏢 ADR-034: Centralized Validation Bounds
import { OPACITY_BOUNDS, GRIP_BOUNDS } from '../config/validation-bounds-config';
// 🏢 SSoT base grip size
import { GRIP_SIZE_DEFAULT } from '../config/grip-size-default';
// 🏢 ADR-559: canonical grip-settings schema (this DTO === GripSettingsFull projection)
import type { GripSettingsFull } from './grip-settings-schema';

// ADR-559 — the AutoCAD-style input DTO is the canonical `GripSettingsFull` projection
// (base + render extras + legacy compat, sentinel colours). One schema, no re-declaration.
export type GripSettings = GripSettingsFull;

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
  gripSize: GRIP_SIZE_DEFAULT, // 🏢 SSoT base grip size (AutoCAD GRIPSIZE = 7)
  pickBoxSize: 3,    // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,  // ✅ AutoCAD APERTURE default: 10 pixels
  showAperture: true, // ✅ AutoCAD APBOX default: enabled

  colors: {
    cold: null,                      // Sentinel: null → GRIP_COLD_COLOR at render time
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
  gripObjLimit: 100,        // ✅ AutoCAD GRIPOBJLIMIT default: hide all grips above 100 selected objects

  // === Display Settings ===
  opacity: 1.0,             // ✅ Full opacity by default
  showMidpoints: true,      // ✅ Show midpoint grips
  showCenters: true,        // ✅ Show center grips
  showQuadrants: true       // ✅ Show quadrant grips
};

// === VALIDATION ===
// 🏢 ADR-034: Using centralized GRIP_BOUNDS for consistency
export const GRIP_LIMITS = {
  gripSize: { min: GRIP_BOUNDS.SIZE_EXTENDED.min, max: GRIP_BOUNDS.SIZE_EXTENDED.max },
  pickBoxSize: { min: GRIP_BOUNDS.PICK_BOX.min, max: GRIP_BOUNDS.PICK_BOX.max },
  apertureSize: { min: GRIP_BOUNDS.APERTURE.min, max: GRIP_BOUNDS.APERTURE.max }
} as const;

export function validateGripSettings(settings: Partial<GripSettings>): GripSettings {
  const result = { ...DEFAULT_GRIP_SETTINGS, ...settings };

  // 🏢 ADR-034: Clamp values using centralized validation bounds
  result.gripSize = clamp(result.gripSize, GRIP_BOUNDS.SIZE_EXTENDED.min, GRIP_BOUNDS.SIZE_EXTENDED.max);
  result.pickBoxSize = clamp(result.pickBoxSize, GRIP_BOUNDS.PICK_BOX.min, GRIP_BOUNDS.PICK_BOX.max);
  result.apertureSize = clamp(result.apertureSize, GRIP_BOUNDS.APERTURE.min, GRIP_BOUNDS.APERTURE.max);

  // 🏢 ADR-034: Clamp additional settings using centralized validation bounds
  result.opacity = clamp(result.opacity, OPACITY_BOUNDS.VISIBLE.min, OPACITY_BOUNDS.VISIBLE.max);
  result.maxGripsPerEntity = clamp(result.maxGripsPerEntity, GRIP_BOUNDS.MAX_PER_ENTITY.min, GRIP_BOUNDS.MAX_PER_ENTITY.max);
  result.gripObjLimit = clamp(result.gripObjLimit, GRIP_BOUNDS.OBJ_LIMIT.min, GRIP_BOUNDS.OBJ_LIMIT.max);

  return result;
}
