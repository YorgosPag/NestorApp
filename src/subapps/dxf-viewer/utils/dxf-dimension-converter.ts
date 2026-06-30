/**
 * 🏢 ENTERPRISE: DXF Dimension Converter (ADR-362 Phase R-import).
 *
 * Converts a DXF DIMENSION entity into a SINGLE first-class `DimensionEntity`
 * (`type:'dimension'`) so imported dims flow through the SAME Revit-grade
 * pipeline as Ribbon-created dims: `DimensionRenderer` draws dim line +
 * extension lines + REAL ARROWHEADS + formatted text (ADR-362), instead of the
 * pre-ADR-362 decomposition into dumb `text` + `line` primitives.
 *
 * Style resolution: the entity carries `styleId: ''`. At render time
 * `resolveDimStyle()` falls back to the registry's ACTIVE style, which the
 * import pipeline has already seeded from the file's DIMSTYLE table via
 * `registerImportedDimStyles()` (useDxfSceneConversion). So an imported dim
 * renders with the file's own DIMTXT / DIMASZ / colours (ByLayer → layer
 * colour) — exactly like AutoCAD/Revit. Per-entity multi-DIMSTYLE fidelity
 * (mapping code-3 style name → registry id) is Phase 2.
 *
 * Coverage (Phase 1 — the architectural ~90% of floor-plan dims):
 *   - linear   (type 0) → LinearDimensionEntity   defPoints [o1, o2, dimLineRef] + rotation
 *   - aligned  (type 1) → AlignedDimensionEntity  defPoints [o1, o2, dimLineRef]
 *   - diameter (type 3) → DiameterDimensionEntity defPoints [side1, side2]
 *   - radius   (type 4) → RadiusDimensionEntity   defPoints [center, arcPoint]
 * Best-effort (angular 2/5, ordinate 6) → `convertDimensionLegacy()` (text+lines,
 * no regression) until Phase 2 maps their defPoints through the builder.
 *
 * @see types/dimension.ts — DimensionEntity union + defPoints semantics
 * @see systems/dimensions/dim-style-importer.ts — registry seeding
 * @see dxf-dimension-legacy-fallback.ts — angular/ordinate decomposition
 * @see AutoCAD DXF Reference for DIMENSION entity codes
 */

import type { AnySceneEntity } from '../types/scene';
import type { Point2D } from '../rendering/types/Types';
import type {
  AlignedDimensionEntity,
  DiameterDimensionEntity,
  DimensionType,
  LinearDimensionEntity,
  RadiusDimensionEntity,
} from '../types/dimension';
import type { DxfHeaderData, DimStyleMap } from './dxf-entity-parser';
import { convertDimensionLegacy } from './dxf-dimension-legacy-fallback';

// ============================================================================
// DXF DIMENSION TYPE (group code 70, bits 0-2) → DimensionType
// ============================================================================

/** Variants handled by the first-class `DimensionEntity` path. Others fall back. */
const DIM_TYPE_MAP: Record<number, Extract<DimensionType, 'linear' | 'aligned' | 'radius' | 'diameter'>> = {
  0: 'linear',
  1: 'aligned',
  3: 'diameter',
  4: 'radius',
};

// ============================================================================
// FIELD HELPERS
// ============================================================================

/** Parse a DXF (xCode, yCode) coordinate pair → Point2D, or null when either is NaN. */
function point(data: Record<string, string>, xCode: string, yCode: string): Point2D | null {
  const x = parseFloat(data[xCode]);
  const y = parseFloat(data[yCode]);
  if (isNaN(x) || isNaN(y)) return null;
  return { x, y };
}

/**
 * Resolve the DIMSTYLE user-text token (DXF code 1) to the renderer convention:
 *   - absent / empty  → `undefined` (renderer draws the MEASURED value)
 *   - '<>'            → measured (passed through)
 *   - anything else   → literal override
 */
function resolveUserText(raw: string | undefined): string | undefined {
  return raw === undefined || raw === '' ? undefined : raw;
}

/** Common fields shared by every imported `DimensionEntity` variant. */
function buildCommonFields(
  data: Record<string, string>,
  layer: string,
  index: number,
): {
  id: string;
  type: 'dimension';
  layerId: string;
  visible: true;
  styleId: string;
  textMidpoint?: Point2D;
  userText?: string;
  measurementValue?: number;
} {
  const textMid = point(data, '11', '21');
  const userText = resolveUserText(data['1']);
  const measurement = parseFloat(data['42']);
  return {
    id: `dimension_${index}`,
    type: 'dimension',
    layerId: layer,
    visible: true,
    // '' → resolveDimStyle() falls back to the active (file-imported) DIMSTYLE.
    styleId: '',
    ...(textMid && { textMidpoint: textMid }),
    ...(userText !== undefined && { userText }),
    ...(isNaN(measurement) ? {} : { measurementValue: measurement }),
  };
}

// ============================================================================
// PER-VARIANT BUILDERS
// ============================================================================

/**
 * Linear / aligned share defPoints [extOrigin1 (13/23), extOrigin2 (14/24),
 * dimLineRef (10/20)]. Legacy `startPoint`/`endPoint`/`textPosition` are filled
 * too so the Phase-A1 consumers (PathCache hash, InsertionSnapEngine) keep
 * working until they migrate to `defPoints`.
 */
function buildLinearOrAligned(
  variant: 'linear' | 'aligned',
  data: Record<string, string>,
  layer: string,
  index: number,
): LinearDimensionEntity | AlignedDimensionEntity | null {
  const o1 = point(data, '13', '23');
  const o2 = point(data, '14', '24');
  const dimRef = point(data, '10', '20');
  if (!o1 || !o2 || !dimRef) return null;

  const common = buildCommonFields(data, layer, index);
  const defPoints = [o1, o2, dimRef] as const;
  const legacy = { startPoint: o1, endPoint: o2, ...(common.textMidpoint && { textPosition: common.textMidpoint }) };

  if (variant === 'linear') {
    const rot = parseFloat(data['50']);
    return { ...common, dimensionType: 'linear', defPoints: [...defPoints], rotation: isNaN(rot) ? 0 : rot, ...legacy };
  }
  return { ...common, dimensionType: 'aligned', defPoints: [...defPoints], ...legacy };
}

/** Radius — defPoints [center (15/25), arcPoint (10/20)]. */
function buildRadius(
  data: Record<string, string>,
  layer: string,
  index: number,
): RadiusDimensionEntity | null {
  const center = point(data, '15', '25');
  const arcPoint = point(data, '10', '20');
  if (!center || !arcPoint) return null;
  const common = buildCommonFields(data, layer, index);
  return { ...common, dimensionType: 'radius', defPoints: [center, arcPoint], startPoint: center, endPoint: arcPoint };
}

/** Diameter — defPoints [side1 (10/20), side2 (15/25)]. */
function buildDiameter(
  data: Record<string, string>,
  layer: string,
  index: number,
): DiameterDimensionEntity | null {
  const side1 = point(data, '10', '20');
  const side2 = point(data, '15', '25');
  if (!side1 || !side2) return null;
  const common = buildCommonFields(data, layer, index);
  return { ...common, dimensionType: 'diameter', defPoints: [side1, side2], startPoint: side1, endPoint: side2 };
}

// ============================================================================
// MAIN DIMENSION CONVERTER
// ============================================================================

/**
 * Convert a DXF DIMENSION entity to a first-class `DimensionEntity` (linear /
 * aligned / radius / diameter), or fall back to the legacy text+line
 * decomposition for the angular / ordinate families.
 *
 * @param data - Raw DXF entity data (flat code→value map)
 * @param layer - Layer name
 * @param index - Entity index for ID generation
 * @param header - Optional DXF header (legacy fallback DIMSCALE/DIMTXT)
 * @param dimStyles - Optional parsed DIMSTYLE map (legacy fallback text height)
 */
export function convertDimension(
  data: Record<string, string>,
  layer: string,
  index: number,
  header?: DxfHeaderData,
  dimStyles?: DimStyleMap
): AnySceneEntity[] {
  const dimType = parseInt(data['70'] || '0', 10) & 0x07;
  const variant = DIM_TYPE_MAP[dimType];

  if (variant === 'linear' || variant === 'aligned') {
    const entity = buildLinearOrAligned(variant, data, layer, index);
    return entity ? [entity] : [];
  }
  if (variant === 'radius') {
    const entity = buildRadius(data, layer, index);
    return entity ? [entity] : [];
  }
  if (variant === 'diameter') {
    const entity = buildDiameter(data, layer, index);
    return entity ? [entity] : [];
  }

  // Angular (2-line / 3-point) + ordinate — best-effort until Phase 2.
  return convertDimensionLegacy(data, layer, index, header, dimStyles);
}
