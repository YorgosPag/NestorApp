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
 * Coverage (all first-class families — AutoCAD DXF spec def-point mapping):
 *   - linear    (type 0) → LinearDimensionEntity    defPoints [o1, o2, dimLineRef] + rotation
 *   - aligned   (type 1) → AlignedDimensionEntity   defPoints [o1, o2, dimLineRef]
 *   - angular2L (type 2) → Angular2LDimensionEntity defPoints [l1a, l1b, l2a, l2b, arcPoint]
 *   - diameter  (type 3) → DiameterDimensionEntity  defPoints [side1, side2]
 *   - radius    (type 4) → RadiusDimensionEntity    defPoints [center, arcPoint]
 *   - angular3P (type 5) → Angular3PDimensionEntity defPoints [vertex, ray1, ray2, arcPoint]
 *   - ordinate  (type 6) → OrdinateDimensionEntity  defPoints [feature] + axis + datum
 * Phase 2 (this): angular/ordinate now render through the arrowhead-aware
 * `DimensionRenderer` instead of the legacy text+line decomposition. The legacy
 * fallback remains only for any genuinely unmapped variant (no regression).
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
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  DiameterDimensionEntity,
  DimensionType,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../types/dimension';
import type { DxfHeaderData, DimStyleMap } from './dxf-entity-parser';
import { convertDimensionLegacy } from './dxf-dimension-legacy-fallback';

// ============================================================================
// DXF DIMENSION TYPE (group code 70, bits 0-2) → DimensionType
// ============================================================================

/** Variants handled by the first-class `DimensionEntity` path. Others fall back. */
const DIM_TYPE_MAP: Record<
  number,
  Extract<
    DimensionType,
    'linear' | 'aligned' | 'radius' | 'diameter' | 'angular2L' | 'angular3P' | 'ordinate'
  >
> = {
  0: 'linear',
  1: 'aligned',
  2: 'angular2L',
  3: 'diameter',
  4: 'radius',
  5: 'angular3P',
  6: 'ordinate',
};

/** DXF code-70 bit 6 (value 64): ordinate is X-type when set, Y-type when clear. */
const ORDINATE_X_FLAG = 64;

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

/**
 * Angular 2-line (AutoCAD spec) — line1 = (13,23)→(14,24), line2 = (10,20)→(15,25),
 * arc = (16,26). Maps to the builder's `[line1.a, line1.b, line2.a, line2.b, arcPoint]`
 * (the vertex is derived at build time from the two-line intersection).
 */
function buildAngular2L(
  data: Record<string, string>,
  layer: string,
  index: number,
): Angular2LDimensionEntity | null {
  const line1a = point(data, '13', '23');
  const line1b = point(data, '14', '24');
  const line2a = point(data, '10', '20');
  const line2b = point(data, '15', '25');
  const arcPoint = point(data, '16', '26');
  if (!line1a || !line1b || !line2a || !line2b || !arcPoint) return null;
  const common = buildCommonFields(data, layer, index);
  return {
    ...common,
    dimensionType: 'angular2L',
    defPoints: [line1a, line1b, line2a, line2b, arcPoint],
    startPoint: line1a,
    endPoint: arcPoint,
  };
}

/**
 * Angular 3-point (AutoCAD spec) — vertex = (15,25), ray1 = (13,23), ray2 = (14,24),
 * arc = (16,26) (falls back to the code-10 dim-line point). Maps to the builder's
 * `[vertex, ray1End, ray2End, arcPoint]`.
 */
function buildAngular3P(
  data: Record<string, string>,
  layer: string,
  index: number,
): Angular3PDimensionEntity | null {
  const vertex = point(data, '15', '25');
  const ray1 = point(data, '13', '23');
  const ray2 = point(data, '14', '24');
  const arcPoint = point(data, '16', '26') ?? point(data, '10', '20');
  if (!vertex || !ray1 || !ray2 || !arcPoint) return null;
  const common = buildCommonFields(data, layer, index);
  return {
    ...common,
    dimensionType: 'angular3P',
    defPoints: [vertex, ray1, ray2, arcPoint],
    startPoint: vertex,
    endPoint: arcPoint,
  };
}

/**
 * Ordinate (AutoCAD spec) — feature = (13,23), origin/datum = (10,20), leader end =
 * (14,24). `axis` from code-70 bit 64 (set → X-type, clear → Y-type). defPoints =
 * [featurePoint]; the leader endpoint becomes `textMidpoint` so the builder
 * terminates the leader where AutoCAD placed it.
 */
function buildOrdinate(
  data: Record<string, string>,
  layer: string,
  index: number,
): OrdinateDimensionEntity | null {
  const feature = point(data, '13', '23');
  const datum = point(data, '10', '20');
  if (!feature || !datum) return null;
  const rawFlag = parseInt(data['70'] || '0', 10);
  const axis: 'x' | 'y' = rawFlag & ORDINATE_X_FLAG ? 'x' : 'y';
  const leaderEnd = point(data, '14', '24');
  const common = buildCommonFields(data, layer, index);
  return {
    ...common,
    dimensionType: 'ordinate',
    axis,
    datum,
    defPoints: [feature],
    startPoint: feature,
    endPoint: leaderEnd ?? datum,
    ...(leaderEnd ? { textMidpoint: leaderEnd } : {}),
  };
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
  if (variant === 'angular2L') {
    const entity = buildAngular2L(data, layer, index);
    return entity ? [entity] : [];
  }
  if (variant === 'angular3P') {
    const entity = buildAngular3P(data, layer, index);
    return entity ? [entity] : [];
  }
  if (variant === 'ordinate') {
    const entity = buildOrdinate(data, layer, index);
    return entity ? [entity] : [];
  }

  // Any remaining/unmapped variant → legacy text+line decomposition (no regression).
  return convertDimensionLegacy(data, layer, index, header, dimStyles);
}
