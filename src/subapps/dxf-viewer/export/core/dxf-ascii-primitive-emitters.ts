/**
 * DXF ASCII — low-level primitive emitters + geometry/format helpers.
 *
 * Pure serializers for the atomic DXF entities (LINE / CIRCLE / ARC / POINT / 3DFACE /
 * POLYLINE-path) plus the arc tessellator and the DXF number formatter. Extracted from
 * `dxf-ascii-writer.ts` (file-size SRP split, N.7.1 / ADR-505 §A) so the writer stays
 * under the 500-line limit. Every emitter takes the scale-aware `pair` sink — no shared
 * state — so the entity writer, the dimension-block writer and the HATCH writer all reuse
 * the ONE definition (zero divergence).
 *
 * ADR-644 (#9e) — each emitter has TWO shapes selected by the optional `r2018` context:
 *   • bare (Tekton / round-trip / injected HATCH-explode): geometry + trailing `8`/`62`,
 *     R12-minimal, byte-identical to the pre-644 output.
 *   • R2018 (professional AutoCAD): `100 AcDbEntity` + common codes (8/62 + style) BEFORE the
 *     geometry, then the geometry `100 AcDb<Class>` subclass marker — or AutoCAD aborts DXFIN
 *     («Class separator for class AcDbEntity expected»). The `5` handle is injected by the
 *     writer's `pair` sink right after the `0 <TYPE>`.
 *
 * @module export/core/dxf-ascii-primitive-emitters
 * @see export/core/dxf-ascii-writer — the consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineweightMm } from '../../types/entities';
import type { Pair } from './dxf-ascii-hatch-writer';
// ADR-636 Φ2.4 (D.6) — DXF group 370 encoder SSoT (inverse του import `parseDxfCode370`).
// ΟΧΙ νέος πίνακας: το lineweightMm→enum-code ζει ΜΟΝΟ στον ISO catalog.
import { encodeDxfCode370, isConcreteLineweight } from '../../config/lineweight-iso-catalog';
// ADR-507 — per-entity transparency (DXF 440) codec SSoT (inverse του import `decodeDxf440`).
import { encodeDxf440 } from './dxf-transparency-440';

const ARC_SEGMENT_DEG = 12;

/**
 * The per-entity STYLE group codes a DXF entity carries in common: linetype name (6),
 * per-object linetype scale / CELTSCALE (48), lineweight (370) and transparency (440).
 * Every field is on `BaseEntity`, so an `Entity` satisfies this structurally.
 */
export interface EntityStyleCodes {
  readonly linetypeName?: string;
  readonly ltscale?: number;
  readonly lineweightMm?: LineweightMm;
  /** AutoCAD object transparency % (0..90). DXF group 440· 0/undefined → κανένας κωδικός. */
  readonly transparency?: number;
}

/**
 * ADR-644 (#9e) — the R2018 entity context. When passed to an emitter, it emits the full
 * `AcDbEntity` common block (subclass marker + layer + colour + style codes) before the geometry,
 * followed by the geometry-class marker. `owner` (330) is optional — AutoCAD DXFIN assigns model
 * space when absent, so we omit it (no need to thread the *Model_Space block-record handle).
 */
export interface EntityR2018 {
  /** Optional owner handle (330). Omitted → no owner group (DXFIN defaults to model space). */
  readonly owner?: string;
  /** Common style codes (6/48/370/440) folded into the AcDbEntity block. */
  readonly style?: EntityStyleCodes;
}

/**
 * Emit the common per-entity STYLE group codes — the EXACT inverse of the import
 * extractors (`extractEntityLinetype` / `extractEntityLtscale` / `extractEntityLineweight`
 * in `dxf-entity-style-extract.ts`), keeping the round-trip symmetric:
 *   - **6** linetype name — written only for a concrete name (import already collapses
 *     absent / BYLAYER / BYBLOCK to `undefined`, so a bare entity stays ByLayer).
 *   - **370** lineweight — concrete mm only, encoded via the ISO-catalog `encodeDxfCode370`
 *     SSoT (the sentinels never reach here — import drops them to `undefined`).
 *   - **48** CELTSCALE — a finite positive scale that is not the trivial `1` (mirrors the
 *     import guard `value <= 0 || value === 1 → undefined`).
 *
 * Absent everywhere → nothing emitted, so a style-less entity's envelope is byte-identical
 * to the pre-D.6 output (zero regression). MUST be called inside the entity's group-code
 * block (after code 62, before the next `0`) so the pairs bind to the entity.
 *
 * @see utils/dxf-entity-style-extract — the import extractors this mirrors
 * @see config/lineweight-iso-catalog — encodeDxfCode370 SSoT
 */
export function emitEntityStyle(pair: Pair, style: EntityStyleCodes): void {
  // ADR-644 — «0» is NOT a valid linetype name (a stray layer-ish token some imported entities carry
  // in group 6). No LTYPE record defines it → AutoCAD aborts «Bad linetype name 0». Treat it (and
  // blank) as ByLayer inherit → skip group 6. Every real name the export adapter collects IS defined
  // in the LTYPE table; only the bogus '0'/'' slip through (they are excluded from the table).
  if (style.linetypeName && style.linetypeName !== '0') pair(6, style.linetypeName);
  if (isConcreteLineweight(style.lineweightMm)) pair(370, encodeDxfCode370(style.lineweightMm));
  const lts = style.ltscale;
  if (typeof lts === 'number' && Number.isFinite(lts) && lts > 0 && lts !== 1) pair(48, lts);
  // 440 transparency — concrete value only (encodeDxf440 drops 0/undefined → ByLayer inherit).
  const transp = encodeDxf440(style.transparency);
  if (transp !== undefined) pair(440, transp);
}

/**
 * ADR-644 (#9e) — emit the R2018 `AcDbEntity` common block (owner 330 → `100 AcDbEntity` → layer 8
 * → colour 62 → style codes). The `5` handle precedes it (injected by the sink). Callers follow it
 * with the geometry-class marker (`100 AcDb<Class>`) and the geometry itself. Exported so the TEXT /
 * MTEXT / INSERT writers (own modules, file-size SRP) share the ONE definition.
 */
export function emitAcDbEntity(pair: Pair, layer: string, aci: number, r: EntityR2018): void {
  if (r.owner) pair(330, r.owner);
  pair(100, 'AcDbEntity');
  pair(8, layer);
  pair(62, aci);
  if (r.style) emitEntityStyle(pair, r.style);
}

/** ADR-644 (#9e) — the AcDbEntity block for a sub-entity (VERTEX/SEQEND): layer only, no colour. */
function emitSubEntity(pair: Pair, layer: string, owner?: string): void {
  if (owner) pair(330, owner);
  pair(100, 'AcDbEntity');
  pair(8, layer);
}

/** A `3DFACE` — up to 4 corners (triangle → 4th = 3rd). x/y × `s`, z (mm) × mmScale. */
export function emit3DFace(
  face: ReadonlyArray<{ x: number; y: number; zMm: number }>,
  layer: string, aci: number, s: number, mmScale: number, pair: Pair, r2018?: EntityR2018,
): void {
  if (face.length < 3) return;
  const c = [face[0], face[1], face[2], face[3] ?? face[2]]; // tri → 4η κορυφή = 3η
  pair(0, '3DFACE');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbFace'); }
  for (let i = 0; i < 4; i += 1) {
    pair(10 + i, c[i].x * s);
    pair(20 + i, c[i].y * s);
    pair(30 + i, c[i].zMm * mmScale);
  }
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

/**
 * A `SOLID` / `TRACE` / `3DFACE` — filled quad/triangle, the EXACT inverse of the import
 * `parseQuadVertices` (utils/dxf-quad-fill-converter): the import stores the boundary in
 * DRAW order (1-2-4-3 bowtie-corrected), so to reproduce the original DXF we un-bowtie back
 * to the corner slots 10=v1 / 11=v2 / 12=v3 / 13=v4. A triangle (3 vertices) repeats the 3rd
 * corner in slot 13 (the DXF triangle convention parseQuadVertices reads). Z is 0 — SOLID/TRACE
 * are 2D and the 3DFACE import already projected Z away (2D viewer), so a flat face is honest.
 *
 * @see utils/dxf-quad-fill-converter — parseQuadVertices, the import this mirrors
 */
export function emitQuadFill(
  kind: 'SOLID' | 'TRACE' | '3DFACE', vertices: readonly Point2D[], layer: string, aci: number, s: number,
  pair: Pair, r2018?: EntityR2018,
): void {
  if (vertices.length < 3) return;
  const quad = vertices.length >= 4;
  const v1 = vertices[0];             // draw[0]
  const v2 = vertices[1];             // draw[1]
  const v3 = quad ? vertices[3] : vertices[2]; // draw[3] (triangle → 3rd corner)
  const v4 = vertices[2];             // draw[2] (triangle → == v3)
  pair(0, kind);
  // SOLID/TRACE → AcDbTrace subclass· 3DFACE → AcDbFace.
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, kind === '3DFACE' ? 'AcDbFace' : 'AcDbTrace'); }
  pair(10, v1.x * s); pair(20, v1.y * s); pair(30, 0);
  pair(11, v2.x * s); pair(21, v2.y * s); pair(31, 0);
  pair(12, v3.x * s); pair(22, v3.y * s); pair(32, 0);
  pair(13, v4.x * s); pair(23, v4.y * s); pair(33, 0);
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

/** A LINE — coordinates first, layer, colour (ACI). Optional Z per endpoint (3Δ rebar). */
export function emitLine(
  a: Point2D, b: Point2D, layer: string, aci: number, s: number, pair: Pair,
  za?: number, zb?: number, r2018?: EntityR2018,
): void {
  pair(0, 'LINE');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbLine'); }
  pair(10, a.x * s); pair(20, a.y * s);
  if (za !== undefined) pair(30, za);
  pair(11, b.x * s); pair(21, b.y * s);
  if (zb !== undefined) pair(31, zb);
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

export function emitCircle(
  c: Point2D, r: number, layer: string, aci: number, s: number, pair: Pair, r2018?: EntityR2018,
): void {
  pair(0, 'CIRCLE');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbCircle'); }
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

/** A POINT — position (× `s`), layer, colour (ACI). Display glyph lives in the HEADER ($PDMODE/$PDSIZE). */
export function emitPoint(
  p: Point2D, layer: string, aci: number, s: number, pair: Pair, r2018?: EntityR2018,
): void {
  pair(0, 'POINT');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbPoint'); }
  pair(10, p.x * s); pair(20, p.y * s); pair(30, 0);
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

export function emitArc(
  c: Point2D, r: number, startDeg: number, endDeg: number, layer: string, aci: number, s: number,
  pair: Pair, r2018?: EntityR2018,
): void {
  pair(0, 'ARC');
  // R2018 ARC is a two-subclass entity: AcDbCircle (centre/radius) then AcDbArc (angles).
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbCircle'); }
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  if (r2018) pair(100, 'AcDbArc');
  pair(50, startDeg); pair(51, endDeg);
  if (!r2018) { pair(8, layer); pair(62, aci); }
}

/**
 * Emit a vertex path — as a single `POLYLINE` (AutoCAD) or, when `explode`,
 * as individual `LINE` segments (Tekton has no POLYLINE).
 */
export function emitPath(
  vertices: readonly Point2D[], closed: boolean, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
  thickness = 0, style?: EntityStyleCodes, r2018?: EntityR2018,
): void {
  if (vertices.length < 2) return;
  if (explode) {
    for (let i = 0; i < vertices.length - 1; i += 1) {
      emitLine(vertices[i], vertices[i + 1], layer, aci, s, pair);
    }
    if (closed && vertices.length > 2) {
      emitLine(vertices[vertices.length - 1], vertices[0], layer, aci, s, pair);
    }
    return;
  }
  // Old-style POLYLINE (R12-native, universally readable). With `thickness`,
  // AutoCAD extrudes the closed polyline along +Z → pseudo-3D prism.
  pair(0, 'POLYLINE');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDb2dPolyline'); }
  else { pair(8, layer); pair(62, aci); if (style) emitEntityStyle(pair, style); }
  pair(66, 1);                       // vertices-follow flag
  pair(70, closed ? 1 : 0);          // 1 = closed
  if (thickness) pair(39, thickness); // extrusion height (group 39)
  for (const v of vertices) {
    pair(0, 'VERTEX');
    if (r2018) { emitSubEntity(pair, layer, r2018.owner); pair(100, 'AcDbVertex'); pair(100, 'AcDb2dVertex'); }
    else pair(8, layer);
    pair(10, v.x * s); pair(20, v.y * s);
    if (r2018) pair(30, 0);
  }
  pair(0, 'SEQEND');
  if (r2018) emitSubEntity(pair, layer, r2018.owner);
  else pair(8, layer);
}

/**
 * A `LEADER` — annotation callout: ordered path vertices (ARROW TIP = vertices[0]) plus an
 * arrowhead flag. The EXACT inverse of the import `convertLeader` (utils/dxf-leader-converter):
 * the 10/20 pairs stay clean ordered vertices (so `parseVerticesFromPairs` re-reads them), 71 is
 * the arrowhead flag and 62 the colour. `3`(dimstyle 'Standard') / `72`(straight path) /
 * `73`(no annotation) / `76`(vertex count) are the AutoCAD-faithful defaults for fidelity — the
 * import ignores what it does not read, so they never perturb the round-trip. Arrow SIZE is
 * re-derived on import from DIMASZ (a constant, never written to file) so it is NOT emitted.
 *
 * @see utils/dxf-leader-converter — the import extractor this mirrors
 */
export function emitLeader(
  vertices: readonly Point2D[], arrowEnabled: boolean, layer: string, aci: number, s: number, pair: Pair,
  r2018?: EntityR2018,
): void {
  if (vertices.length < 2) return;
  pair(0, 'LEADER');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, 'AcDbLeader'); }
  else { pair(8, layer); pair(62, aci); }
  pair(3, 'Standard');            // dimstyle name (default)
  pair(71, arrowEnabled ? 1 : 0); // arrowhead flag: 0 disabled / 1 enabled
  pair(72, 0);                    // path type: 0 = straight segments
  pair(73, 3);                    // creation flag: 3 = created without annotation
  pair(76, vertices.length);      // number of vertices
  for (const v of vertices) {
    pair(10, v.x * s); pair(20, v.y * s); pair(30, 0);
  }
}

/** Tessellate an arc (degrees, CCW start→end) into a polyline of points. */
export function arcPoints(c: Point2D, r: number, startDeg: number, endDeg: number): Point2D[] {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / ARC_SEGMENT_DEG));
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = ((startDeg + (sweep * i) / steps) * Math.PI) / 180;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

/** DXF number: fixed 6-decimals, trimmed, never exponential. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(6).replace(/\.?0+$/, '') || '0';
}
