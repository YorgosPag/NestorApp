/**
 * AutoCAD-style Grip Settings
 * Βασισμένο στις AutoCAD system variables: GRIPSIZE, PICKBOX, APERTURE
 */

import type { Point2D, GripKind } from '../rendering/types/Types';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../rendering/entities/shared/geometry-utils';
// 🏢 ADR-034: Centralized Validation Bounds
import { OPACITY_BOUNDS, GRIP_BOUNDS } from '../config/validation-bounds-config';
// 🏢 ADR-559 §3b — canonical grip default VALUES (aperture 20, warm ροζ, sentinel cold)
import { GRIP_FACTORY_DEFAULTS } from '../config/grip-factory-defaults';
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
  gripType: Extract<GripKind, 'vertex' | 'edge' | 'center' | 'corner'>; // ADR-559 projection of canonical GripKind
}

export interface GripInteractionState {
  hovered?: { entityId: string; gripIndex: number };
  active?: { entityId: string; gripIndex: number };
}

// === DEFAULT AUTOCAD-STYLE SETTINGS (International Standards) ===
// 🏢 ADR-559 §3b — DERIVED from canonical GRIP_FACTORY_DEFAULTS (aperture 20, warm ροζ,
// sentinel cold). This input-DTO adds only the render extras (showGripTips / dpiScale);
// the VALUES live once in config/grip-factory-defaults.ts.
export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  ...GRIP_FACTORY_DEFAULTS,
  showGripTips: false,      // Grip tooltips disabled by default
  dpiScale: 1.0             // Default DPI scale
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
