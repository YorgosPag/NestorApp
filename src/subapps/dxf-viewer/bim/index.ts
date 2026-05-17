/**
 * BIM Drawing Mode — Public API
 * ADR-363: Parametric Building Elements (Phase 0 Bootstrap)
 *
 * Phase 0: Types + IDs + Collections + Indexes + Rules. Zero user-visible code.
 * Phase 1+: Wall tool, renderers, grips, ribbon panel.
 */

// Base types (Phase 0)
export type {
  BimElementType,
  BimElementKind,
  BimEntity,
  BimValidation,
  BimQuantityTakeoff,
  BimLock,
  SoftLock,
  Point3D,
  Polyline3D,
  Polygon3D,
  BoundingBox3D,
  AtoeCategoryCode,
  BimParams,
} from './types/bim-base';

// Stair types (Phase 0.5 — migrated from types/stair.ts)
export type {
  StairKind,
  StairParams,
  StairVariantParams,
  StairGeometry,
  StairDoc,
  StairPresetDoc,
  StairQTO,
  StairValidationState,
  StairEditingLock,
} from './types/stair-types';
