/**
 * DXF DIMENSION Entity Writer — ADR-362 Phase H2/H3.
 *
 * Emits a DXF `ENTITIES` section containing DIMENSION entities, mirroring the
 * pattern of `dxf-dimstyle-writer.ts`. Output: alternating code/value string[]
 * for in-process roundtrip tests (write → inspect group codes; a full reverse
 * DIMENSION parser is out of H2/H3 scope).
 *
 * NOT a production DXF exporter — production export flows through the ezdxf
 * Python microservice (`types/dxf-export.types.ts`).
 *
 * Phase H2: linear, aligned, angular2L, angular3P.
 * Phase H3: radius, diameter, ordinate, arcLength, joggedRadius, baseline, continued.
 *
 * DXF DIMENSION type flags (code 70):
 *   0 = Linear/Rotated    2 = Angular 2-line   4 = Radius
 *   1 = Aligned           3 = Diameter         5 = Angular 3-point
 *   6 = Ordinate          (+ bit 32/64/128 modifiers)
 *
 * defPoints mapping per variant (matches builders in systems/dimensions/builders/):
 *   Linear/Aligned : [extOrigin1, extOrigin2, dimLineRef]
 *   Angular2L      : [line1.a, line1.b, line2.a, line2.b, arcPoint]
 *   Angular3P      : [vertex, ray1End, ray2End, arcPoint]
 *   Radius         : [center, arcPoint]
 *   Diameter       : [side1, side2]
 *   Ordinate       : [featurePoint]  (+ entity.datum)
 *   ArcLength      : [center, arcStart, arcEnd]
 *   JoggedRadius   : [center, arcPoint, jogPoint, jogVertex]
 *   Baseline/Cont  : [newExtOrigin]  (parent chain resolved at render time)
 */

import type {
  DimensionEntity,
  LinearDimensionEntity,
  AlignedDimensionEntity,
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  RadiusDimensionEntity,
  DiameterDimensionEntity,
  ArcLengthDimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
} from '../types/dimension';
import type { Point2D } from '../rendering/types/Types';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** One DIMENSION to emit: the entity + the resolved style name. */
export interface DimensionWriterEntry {
  readonly entity: DimensionEntity;
  /** Style display name (e.g. "ISO-25"). Caller resolves from `entity.styleId`. */
  readonly styleName: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Emit helper
// ──────────────────────────────────────────────────────────────────────────────

function emit(out: string[], code: string, value: string): void {
  out.push(code, value);
}

function emitPt(out: string[], codeXY: [string, string], p: Point2D): void {
  emit(out, codeXY[0], String(p.x));
  emit(out, codeXY[1], String(p.y));
  // Z component always 0.0 for 2D DXF
  const codeZ = String(Number(codeXY[1]) + 10);
  emit(out, codeZ, '0.0');
}

// ──────────────────────────────────────────────────────────────────────────────
// Common dimension header (AcDbEntity + AcDbDimension)
// ──────────────────────────────────────────────────────────────────────────────

function emitDimHeader(
  out: string[],
  entry: DimensionWriterEntry,
  typeFlag: number,
  blockIndex: number,
): void {
  const { entity, styleName } = entry;

  emit(out, '0', 'DIMENSION');
  emit(out, '100', 'AcDbEntity');
  emit(out, '8', entity.layerId ?? '0');        // layer name
  emit(out, '100', 'AcDbDimension');
  emit(out, '2', `*D${blockIndex}`);             // anonymous block reference

  // Code 10/20/30: generic "def point" (dim line reference for linear; arc center for angular)
  const refPt = resolveRefPoint(entity);
  emitPt(out, ['10', '20'], refPt);

  // Code 11/21/31: text midpoint (user override or geometric midpoint)
  const textPt = entity.textMidpoint ?? refPt;
  emitPt(out, ['11', '21'], textPt);

  emit(out, '70', String(typeFlag));

  // Code 1: text override ('' = use measured value in AutoCAD)
  const textCode1 = resolveTextCode1(entity.userText);
  emit(out, '1', textCode1);

  emit(out, '3', styleName);

  // Code 42: measurement value (0 if not yet computed)
  emit(out, '42', String(entity.measurementValue ?? 0));

  // Code 53: text rotation override (degrees, 0 = none)
  if (entity.textRotation !== undefined) {
    emit(out, '53', String(entity.textRotation));
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Subclass emitters (one per DXF dimension subclass)
// ──────────────────────────────────────────────────────────────────────────────

function emitLinearSubclass(out: string[], entity: LinearDimensionEntity): void {
  emit(out, '100', 'AcDbAlignedDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 });
  emitPt(out, ['14', '24'], entity.defPoints[1] ?? { x: 0, y: 0 });
  // Code 50: dim line rotation (degrees, 0 = horizontal)
  emit(out, '50', String(entity.rotation ?? 0));
  emit(out, '100', 'AcDbRotatedDimension');
}

function emitAlignedSubclass(out: string[], entity: AlignedDimensionEntity): void {
  emit(out, '100', 'AcDbAlignedDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 });
  emitPt(out, ['14', '24'], entity.defPoints[1] ?? { x: 0, y: 0 });
  // No rotation code for aligned — alignment is derived from geometry
}

function emitAngular2LSubclass(out: string[], entity: Angular2LDimensionEntity): void {
  emit(out, '100', 'AcDb2LineAngularDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // line1.a
  emitPt(out, ['14', '24'], entity.defPoints[1] ?? { x: 0, y: 0 }); // line1.b
  emitPt(out, ['15', '25'], entity.defPoints[2] ?? { x: 0, y: 0 }); // line2.a
  // defPoints[3] = line2.b — not needed for DXF (vertex = intersection of lines)
  // code 16/26: arc point (defPoints[4])
  emitPt(out, ['16', '26'], entity.defPoints[4] ?? entity.defPoints[3] ?? { x: 0, y: 0 });
}

function emitAngular3PSubclass(out: string[], entity: Angular3PDimensionEntity): void {
  emit(out, '100', 'AcDb3PointAngularDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // vertex
  emitPt(out, ['14', '24'], entity.defPoints[1] ?? { x: 0, y: 0 }); // ray1End
  emitPt(out, ['15', '25'], entity.defPoints[2] ?? { x: 0, y: 0 }); // ray2End
  emitPt(out, ['16', '26'], entity.defPoints[3] ?? { x: 0, y: 0 }); // arcPoint
}

function emitRadiusSubclass(out: string[], entity: RadiusDimensionEntity): void {
  emit(out, '100', 'AcDbRadialDimension');
  emitPt(out, ['15', '25'], entity.defPoints[1] ?? { x: 0, y: 0 }); // arcPoint
}

function emitDiameterSubclass(out: string[], entity: DiameterDimensionEntity): void {
  emit(out, '100', 'AcDbDiametricDimension');
  emitPt(out, ['15', '25'], entity.defPoints[1] ?? { x: 0, y: 0 }); // side2
}

function emitOrdinateSubclass(out: string[], entity: OrdinateDimensionEntity): void {
  emit(out, '100', 'AcDbOrdinateDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // featurePoint
  const leaderEnd = entity.textMidpoint ?? entity.defPoints[0] ?? { x: 0, y: 0 };
  emitPt(out, ['14', '24'], leaderEnd);
}

function emitArcLengthSubclass(out: string[], entity: ArcLengthDimensionEntity): void {
  emit(out, '100', 'AcDbArcDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // center
  emitPt(out, ['14', '24'], entity.defPoints[1] ?? { x: 0, y: 0 }); // arcStart
  emitPt(out, ['15', '25'], entity.defPoints[2] ?? { x: 0, y: 0 }); // arcEnd
}

function emitJoggedRadiusSubclass(out: string[], entity: JoggedRadiusDimensionEntity): void {
  emit(out, '100', 'AcDbRadialDimensionLarge');
  emitPt(out, ['13', '23'], entity.defPoints[3] ?? { x: 0, y: 0 }); // jogVertex
  emitPt(out, ['15', '25'], entity.defPoints[1] ?? { x: 0, y: 0 }); // arcPoint
  emitPt(out, ['16', '26'], entity.defPoints[2] ?? { x: 0, y: 0 }); // jogPoint
}

function emitBaselineSubclass(out: string[], entity: BaselineDimensionEntity): void {
  emit(out, '100', 'AcDbAlignedDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // newExtOrigin
}

function emitContinuedSubclass(out: string[], entity: ContinuedDimensionEntity): void {
  emit(out, '100', 'AcDbAlignedDimension');
  emitPt(out, ['13', '23'], entity.defPoints[0] ?? { x: 0, y: 0 }); // newExtOrigin
}

// ──────────────────────────────────────────────────────────────────────────────
// Entity dispatch
// ──────────────────────────────────────────────────────────────────────────────

function emitOneDimension(
  out: string[],
  entry: DimensionWriterEntry,
  blockIndex: number,
): void {
  const { entity } = entry;
  switch (entity.dimensionType) {
    case 'linear':
      emitDimHeader(out, entry, 0, blockIndex);
      emitLinearSubclass(out, entity);
      break;
    case 'aligned':
      emitDimHeader(out, entry, 1, blockIndex);
      emitAlignedSubclass(out, entity);
      break;
    case 'angular2L':
      emitDimHeader(out, entry, 2, blockIndex);
      emitAngular2LSubclass(out, entity);
      break;
    case 'angular3P':
      emitDimHeader(out, entry, 5, blockIndex);
      emitAngular3PSubclass(out, entity);
      break;
    case 'radius':
      emitDimHeader(out, entry, 4, blockIndex);
      emitRadiusSubclass(out, entity);
      break;
    case 'diameter':
      emitDimHeader(out, entry, 3, blockIndex);
      emitDiameterSubclass(out, entity);
      break;
    case 'ordinate': {
      const flag = entity.axis === 'y' ? 6 | 64 : 6;
      emitDimHeader(out, entry, flag, blockIndex);
      emitOrdinateSubclass(out, entity);
      break;
    }
    case 'arcLength':
      emitDimHeader(out, entry, 32, blockIndex);
      emitArcLengthSubclass(out, entity);
      break;
    case 'joggedRadius':
      emitDimHeader(out, entry, 36, blockIndex);
      emitJoggedRadiusSubclass(out, entity);
      break;
    case 'baseline':
      emitDimHeader(out, entry, 32, blockIndex);
      emitBaselineSubclass(out, entity);
      break;
    case 'continued':
      emitDimHeader(out, entry, 64, blockIndex);
      emitContinuedSubclass(out, entity);
      break;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────────

function resolveRefPoint(entity: DimensionEntity): Point2D {
  // Linear / aligned / baseline / continued: dimLineRef = defPoints[2]
  if (
    entity.dimensionType === 'linear' ||
    entity.dimensionType === 'aligned' ||
    entity.dimensionType === 'baseline' ||
    entity.dimensionType === 'continued'
  ) {
    return entity.defPoints[2] ?? entity.defPoints[0] ?? { x: 0, y: 0 };
  }
  // Angular: arc/vertex reference
  if (entity.dimensionType === 'angular2L') {
    return entity.defPoints[4] ?? entity.defPoints[0] ?? { x: 0, y: 0 };
  }
  if (entity.dimensionType === 'angular3P') {
    return entity.defPoints[3] ?? entity.defPoints[0] ?? { x: 0, y: 0 };
  }
  // Ordinate: datum is the reference origin (code 10/20)
  if (entity.dimensionType === 'ordinate') {
    return entity.datum;
  }
  // Everything else (radius, diameter, arcLength, joggedRadius): first defPoint
  return entity.defPoints[0] ?? { x: 0, y: 0 };
}

function resolveTextCode1(userText: string | undefined): string {
  // '' = use measured value in AutoCAD (our '<>' and undefined semantics map here)
  if (userText === undefined || userText === '<>') return '';
  return userText;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit a DXF `ENTITIES` section containing the given dimensions.
 * Returns alternating code/value lines (line 2i = code, 2i+1 = value).
 *
 * All 11 DimensionType variants fully implemented (H2 + H3).
 */
export function writeDimensionSection(entries: ReadonlyArray<DimensionWriterEntry>): string[] {
  const out: string[] = [];

  emit(out, '0', 'SECTION');
  emit(out, '2', 'ENTITIES');

  for (let i = 0; i < entries.length; i++) {
    emitOneDimension(out, entries[i], i);
  }

  emit(out, '0', 'ENDSEC');
  return out;
}
