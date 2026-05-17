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
  SoftLock,
  Point3D,
  Polyline3D,
  Polygon3D,
  BoundingBox3D,
  AtoeCategoryCode,
  BimParams,
} from './types/bim-base';
