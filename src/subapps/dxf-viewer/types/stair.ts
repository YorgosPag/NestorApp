/**
 * Barrel re-export — ADR-363 Phase 0.5 Stair Migration.
 *
 * StairEntity + all stair types moved to `bim/types/stair-types.ts`.
 * This file is preserved for backward compat with all 72+ importing files.
 * Migrate imports to `../bim/types/stair-types` via Boy Scout rule.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase0.5
 */
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
} from '../bim/types/stair-types';

export {
  isLShapeLandingVariant,
  isLShapeWindersVariant,
  isStairKind,
} from '../bim/types/stair-types';
