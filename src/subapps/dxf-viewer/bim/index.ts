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

// Stair types (Phase 0.5 — migrated from types/stair.ts to bim/types/stair-types.ts)
export type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  BoundingBox3D,
  StairKind,
  StairStructureType,
  StairRiserType,
  StairNosingSide,
  StairCodeProfile,
  StairNokSubType,
  StairTreadLabelDisplay,
  StairUpDirection,
  StairTurnDirectionLR,
  StairTurnDirectionCW,
  StairLandingCornerStyle,
  StairWinderMethod,
  StairMultiStoryConfig,
  StairStringerParams,
  StairMaterials,
  StairPerTreadOverride,
  StairHandrails,
  StairVariantParams,
  StairVariantStraight,
  StairVariantLShape,
  StairVariantLShapeLanding,
  StairVariantLShapeWinders,
  StairVariantUShape,
  StairVariantGamma,
  StairVariantSpiral,
  StairVariantHelical,
  StairVariantElliptical,
  StairVariantWinder,
  StairVariantTriangularFan,
  StairVariantTriangularOutline,
  StairVariantSketch,
  StairVariantVShape,
  StairParams,
  StairTreadLabel,
  StairArrowSymbol,
  StairStringerGeometry,
  StairHandrailGeometry,
  StairGeometry,
  StairValidationState,
  StairQTO,
  StairEditingLock,
  StairEntity,
  StairDoc,
  StairPresetScope,
  StairPresetDoc,
} from './types/stair-types';

export {
  isLShapeLandingVariant,
  isLShapeWindersVariant,
  isStairKind,
} from './types/stair-types';
