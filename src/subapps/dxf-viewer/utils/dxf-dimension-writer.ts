/**
 * DXF DIMENSION Entity Writer — ADR-362 Phase H2/H3 + Round 24 (production wiring).
 *
 * SSoT for the DXF DIMENSION group-code mapping (all 11 variants). The per-entity
 * core (`emitDimensionEntity`) writes through a generic, scale-aware `DimGroupSink`,
 * so it serves BOTH:
 *   - `writeDimensionSection(...)` — standalone `ENTITIES` section, unscaled
 *     `string[]` for the in-process roundtrip tests (no reverse parser needed);
 *   - the production client-side exporter (`export/core/dxf-ascii-writer.ts`),
 *     which feeds its own scaled/`num()`-formatted `pair` sink so dimensions land
 *     in the real `.dxf` as native DIMENSION entities (Round 24 — before this they
 *     were silently dropped at the writer's entity switch).
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
  /**
   * Resolved layer NAME (code 8). The production exporter resolves `layerId →
   * layer.name` like every other entity, so dims land on the same layer. Omitted
   * by the standalone section writer → falls back to the raw `entity.layerId`.
   */
  readonly layerName?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic group-code sink (SSoT plumbing — shared by the test section writer and
// the production dxf-ascii-writer). Each consumer formats values its own way.
// ──────────────────────────────────────────────────────────────────────────────

/** Emit one DXF group code + value. Numbers are formatted by the sink owner. */
export type DimGroupSink = (code: number, value: string | number) => void;

/** Emit a 2D point (x/y scaled by `scale`, z always 0). */
function emitPt(sink: DimGroupSink, codeX: number, p: Point2D, scale: number): void {
  sink(codeX, p.x * scale);
  sink(codeX + 10, p.y * scale);
  sink(codeX + 20, '0.0'); // Z component always 0.0 for 2D DXF
}

// ──────────────────────────────────────────────────────────────────────────────
// Common dimension header (AcDbEntity + AcDbDimension)
// ──────────────────────────────────────────────────────────────────────────────

function emitDimHeader(
  sink: DimGroupSink,
  entry: DimensionWriterEntry,
  typeFlag: number,
  blockIndex: number,
  scale: number,
): void {
  const { entity, styleName } = entry;

  sink(0, 'DIMENSION');
  sink(100, 'AcDbEntity');
  sink(8, entry.layerName ?? entity.layerId ?? '0'); // resolved layer name (fallback: raw id)
  sink(100, 'AcDbDimension');
  sink(2, `*D${blockIndex}`);              // anonymous block reference

  // Code 10/20/30: generic "def point" (dim line reference for linear; arc center for angular)
  const refPt = resolveRefPoint(entity);
  emitPt(sink, 10, refPt, scale);

  // Code 11/21/31: text midpoint (user override or geometric midpoint)
  const textPt = entity.textMidpoint ?? refPt;
  emitPt(sink, 11, textPt, scale);

  sink(70, typeFlag);

  // Code 1: text override ('' = use measured value in AutoCAD)
  sink(1, resolveTextCode1(entity.userText));

  sink(3, styleName);

  // Code 42: measurement value — a length, so scaled with coordinates (0 if unset).
  sink(42, (entity.measurementValue ?? 0) * scale);

  // Code 53: text rotation override (degrees, 0 = none) — an angle, NOT scaled.
  if (entity.textRotation !== undefined) {
    sink(53, entity.textRotation);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Subclass emitters (one per DXF dimension subclass)
// ──────────────────────────────────────────────────────────────────────────────

const ORIGIN: Point2D = { x: 0, y: 0 };

function emitLinearSubclass(sink: DimGroupSink, entity: LinearDimensionEntity, scale: number): void {
  sink(100, 'AcDbAlignedDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale);
  emitPt(sink, 14, entity.defPoints[1] ?? ORIGIN, scale);
  sink(50, entity.rotation ?? 0); // dim line rotation (degrees) — angle, NOT scaled
  sink(100, 'AcDbRotatedDimension');
}

function emitAlignedSubclass(sink: DimGroupSink, entity: AlignedDimensionEntity, scale: number): void {
  sink(100, 'AcDbAlignedDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale);
  emitPt(sink, 14, entity.defPoints[1] ?? ORIGIN, scale);
  // No rotation code for aligned — alignment is derived from geometry
}

function emitAngular2LSubclass(sink: DimGroupSink, entity: Angular2LDimensionEntity, scale: number): void {
  sink(100, 'AcDb2LineAngularDimension');
  // AutoCAD DXF spec: line1 = code13→code14, line2 = code10(header ref)→code15, arc = code16.
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale); // line1.a
  emitPt(sink, 14, entity.defPoints[1] ?? ORIGIN, scale); // line1.b
  emitPt(sink, 15, entity.defPoints[3] ?? ORIGIN, scale); // line2.b (line2.a is the header code 10)
  emitPt(sink, 16, entity.defPoints[4] ?? entity.defPoints[3] ?? ORIGIN, scale); // arc point
}

function emitAngular3PSubclass(sink: DimGroupSink, entity: Angular3PDimensionEntity, scale: number): void {
  sink(100, 'AcDb3PointAngularDimension');
  // AutoCAD DXF spec: ray1 = code13, ray2 = code14, vertex = code15, arc = code16.
  emitPt(sink, 13, entity.defPoints[1] ?? ORIGIN, scale); // ray1End
  emitPt(sink, 14, entity.defPoints[2] ?? ORIGIN, scale); // ray2End
  emitPt(sink, 15, entity.defPoints[0] ?? ORIGIN, scale); // vertex
  emitPt(sink, 16, entity.defPoints[3] ?? ORIGIN, scale); // arcPoint
}

function emitRadiusSubclass(sink: DimGroupSink, entity: RadiusDimensionEntity, scale: number): void {
  sink(100, 'AcDbRadialDimension');
  emitPt(sink, 15, entity.defPoints[1] ?? ORIGIN, scale); // arcPoint
}

function emitDiameterSubclass(sink: DimGroupSink, entity: DiameterDimensionEntity, scale: number): void {
  sink(100, 'AcDbDiametricDimension');
  emitPt(sink, 15, entity.defPoints[1] ?? ORIGIN, scale); // side2
}

function emitOrdinateSubclass(sink: DimGroupSink, entity: OrdinateDimensionEntity, scale: number): void {
  sink(100, 'AcDbOrdinateDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale); // featurePoint
  const leaderEnd = entity.textMidpoint ?? entity.defPoints[0] ?? ORIGIN;
  emitPt(sink, 14, leaderEnd, scale);
}

function emitArcLengthSubclass(sink: DimGroupSink, entity: ArcLengthDimensionEntity, scale: number): void {
  sink(100, 'AcDbArcDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale); // center
  emitPt(sink, 14, entity.defPoints[1] ?? ORIGIN, scale); // arcStart
  emitPt(sink, 15, entity.defPoints[2] ?? ORIGIN, scale); // arcEnd
}

function emitJoggedRadiusSubclass(sink: DimGroupSink, entity: JoggedRadiusDimensionEntity, scale: number): void {
  sink(100, 'AcDbRadialDimensionLarge');
  emitPt(sink, 13, entity.defPoints[3] ?? ORIGIN, scale); // jogVertex
  emitPt(sink, 15, entity.defPoints[1] ?? ORIGIN, scale); // arcPoint
  emitPt(sink, 16, entity.defPoints[2] ?? ORIGIN, scale); // jogPoint
}

function emitBaselineSubclass(sink: DimGroupSink, entity: BaselineDimensionEntity, scale: number): void {
  sink(100, 'AcDbAlignedDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale); // newExtOrigin
}

function emitContinuedSubclass(sink: DimGroupSink, entity: ContinuedDimensionEntity, scale: number): void {
  sink(100, 'AcDbAlignedDimension');
  emitPt(sink, 13, entity.defPoints[0] ?? ORIGIN, scale); // newExtOrigin
}

// ──────────────────────────────────────────────────────────────────────────────
// Entity dispatch
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Emit ONE DIMENSION entity (header + subclass) through `sink`, coordinates scaled
 * by `scale`. NO section wrapper — the caller owns SECTION/ENTITIES (or feeds an
 * existing entity stream). This is the production-shared core (Round 24).
 */
export function emitDimensionEntity(
  sink: DimGroupSink,
  entry: DimensionWriterEntry,
  blockIndex: number,
  scale = 1,
): void {
  const { entity } = entry;
  switch (entity.dimensionType) {
    case 'linear':
      emitDimHeader(sink, entry, 0, blockIndex, scale);
      emitLinearSubclass(sink, entity, scale);
      break;
    case 'aligned':
      emitDimHeader(sink, entry, 1, blockIndex, scale);
      emitAlignedSubclass(sink, entity, scale);
      break;
    case 'angular2L':
      emitDimHeader(sink, entry, 2, blockIndex, scale);
      emitAngular2LSubclass(sink, entity, scale);
      break;
    case 'angular3P':
      emitDimHeader(sink, entry, 5, blockIndex, scale);
      emitAngular3PSubclass(sink, entity, scale);
      break;
    case 'radius':
      emitDimHeader(sink, entry, 4, blockIndex, scale);
      emitRadiusSubclass(sink, entity, scale);
      break;
    case 'diameter':
      emitDimHeader(sink, entry, 3, blockIndex, scale);
      emitDiameterSubclass(sink, entity, scale);
      break;
    case 'ordinate': {
      // AutoCAD DXF spec code-70 bit 64: set = X-type ordinate, clear = Y-type.
      const flag = entity.axis === 'x' ? 6 | 64 : 6;
      emitDimHeader(sink, entry, flag, blockIndex, scale);
      emitOrdinateSubclass(sink, entity, scale);
      break;
    }
    case 'arcLength':
      emitDimHeader(sink, entry, 32, blockIndex, scale);
      emitArcLengthSubclass(sink, entity, scale);
      break;
    case 'joggedRadius':
      emitDimHeader(sink, entry, 36, blockIndex, scale);
      emitJoggedRadiusSubclass(sink, entity, scale);
      break;
    case 'baseline':
      emitDimHeader(sink, entry, 32, blockIndex, scale);
      emitBaselineSubclass(sink, entity, scale);
      break;
    case 'continued':
      emitDimHeader(sink, entry, 64, blockIndex, scale);
      emitContinuedSubclass(sink, entity, scale);
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
  // Angular 2-line: code 10 = line2.a per DXF spec (line2 = code10 → code15).
  if (entity.dimensionType === 'angular2L') {
    return entity.defPoints[2] ?? entity.defPoints[0] ?? { x: 0, y: 0 };
  }
  // Angular 3-point: code 10 = dim-line arc location (== arcPoint here).
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
 * Returns alternating code/value lines (line 2i = code, 2i+1 = value), unscaled,
 * for the in-process roundtrip tests. Production export feeds `emitDimensionEntity`
 * a scaled `pair` sink directly (see `export/core/dxf-ascii-writer.ts`).
 *
 * All 11 DimensionType variants fully implemented (H2 + H3).
 */
export function writeDimensionSection(entries: ReadonlyArray<DimensionWriterEntry>): string[] {
  const out: string[] = [];
  const sink: DimGroupSink = (code, value) => {
    out.push(String(code), typeof value === 'number' ? String(value) : value);
  };

  sink(0, 'SECTION');
  sink(2, 'ENTITIES');

  for (let i = 0; i < entries.length; i++) {
    emitDimensionEntity(sink, entries[i], i, 1);
  }

  sink(0, 'ENDSEC');
  return out;
}
