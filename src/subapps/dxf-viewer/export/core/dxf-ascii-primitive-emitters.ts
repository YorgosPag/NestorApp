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
 * @module export/core/dxf-ascii-primitive-emitters
 * @see export/core/dxf-ascii-writer — the consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineweightMm } from '../../types/entities';
import type { Pair } from './dxf-ascii-hatch-writer';
// ADR-636 Φ2.4 (D.6) — DXF group 370 encoder SSoT (inverse του import `parseDxfCode370`).
// ΟΧΙ νέος πίνακας: το lineweightMm→enum-code ζει ΜΟΝΟ στον ISO catalog.
import { encodeDxfCode370, isConcreteLineweight } from '../../config/lineweight-iso-catalog';

const ARC_SEGMENT_DEG = 12;

/**
 * The three per-entity STYLE group codes a DXF entity carries in common: linetype
 * name (6), per-object linetype scale / CELTSCALE (48) and lineweight (370). Every
 * field is on `BaseEntity`, so an `Entity` satisfies this structurally.
 */
export interface EntityStyleCodes {
  readonly linetypeName?: string;
  readonly ltscale?: number;
  readonly lineweightMm?: LineweightMm;
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
  if (style.linetypeName) pair(6, style.linetypeName);
  if (isConcreteLineweight(style.lineweightMm)) pair(370, encodeDxfCode370(style.lineweightMm));
  const lts = style.ltscale;
  if (typeof lts === 'number' && Number.isFinite(lts) && lts > 0 && lts !== 1) pair(48, lts);
}

/** A `3DFACE` — up to 4 corners (triangle → 4th = 3rd). x/y × `s`, z (mm) × mmScale. */
export function emit3DFace(
  face: ReadonlyArray<{ x: number; y: number; zMm: number }>,
  layer: string, aci: number, s: number, mmScale: number, pair: Pair,
): void {
  if (face.length < 3) return;
  const c = [face[0], face[1], face[2], face[3] ?? face[2]]; // tri → 4η κορυφή = 3η
  pair(0, '3DFACE');
  for (let i = 0; i < 4; i += 1) {
    pair(10 + i, c[i].x * s);
    pair(20 + i, c[i].y * s);
    pair(30 + i, c[i].zMm * mmScale);
  }
  pair(8, layer);
  pair(62, aci);
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
  kind: 'SOLID' | 'TRACE' | '3DFACE', vertices: readonly Point2D[], layer: string, aci: number, s: number, pair: Pair,
): void {
  if (vertices.length < 3) return;
  const quad = vertices.length >= 4;
  const v1 = vertices[0];             // draw[0]
  const v2 = vertices[1];             // draw[1]
  const v3 = quad ? vertices[3] : vertices[2]; // draw[3] (triangle → 3rd corner)
  const v4 = vertices[2];             // draw[2] (triangle → == v3)
  pair(0, kind);
  pair(10, v1.x * s); pair(20, v1.y * s); pair(30, 0);
  pair(11, v2.x * s); pair(21, v2.y * s); pair(31, 0);
  pair(12, v3.x * s); pair(22, v3.y * s); pair(32, 0);
  pair(13, v4.x * s); pair(23, v4.y * s); pair(33, 0);
  pair(8, layer);
  pair(62, aci);
}

/** A LINE — coordinates first, layer, colour (ACI). Optional Z per endpoint (3Δ rebar). */
export function emitLine(
  a: Point2D, b: Point2D, layer: string, aci: number, s: number, pair: Pair, za?: number, zb?: number,
): void {
  pair(0, 'LINE');
  pair(10, a.x * s); pair(20, a.y * s);
  if (za !== undefined) pair(30, za);
  pair(11, b.x * s); pair(21, b.y * s);
  if (zb !== undefined) pair(31, zb);
  pair(8, layer);
  pair(62, aci);
}

export function emitCircle(c: Point2D, r: number, layer: string, aci: number, s: number, pair: Pair): void {
  pair(0, 'CIRCLE');
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  pair(8, layer);
  pair(62, aci);
}

/** A POINT — position (× `s`), layer, colour (ACI). Display glyph lives in the HEADER ($PDMODE/$PDSIZE). */
export function emitPoint(p: Point2D, layer: string, aci: number, s: number, pair: Pair): void {
  pair(0, 'POINT');
  pair(10, p.x * s); pair(20, p.y * s); pair(30, 0);
  pair(8, layer);
  pair(62, aci);
}

export function emitArc(
  c: Point2D, r: number, startDeg: number, endDeg: number, layer: string, aci: number, s: number, pair: Pair,
): void {
  pair(0, 'ARC');
  pair(10, c.x * s); pair(20, c.y * s);
  pair(40, r * s);
  pair(50, startDeg); pair(51, endDeg);
  pair(8, layer);
  pair(62, aci);
}

/**
 * Emit a vertex path — as a single `POLYLINE` (AutoCAD) or, when `explode`,
 * as individual `LINE` segments (Tekton has no POLYLINE).
 */
export function emitPath(
  vertices: readonly Point2D[], closed: boolean, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
  thickness = 0, style?: EntityStyleCodes,
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
  pair(0, 'POLYLINE'); pair(8, layer); pair(62, aci);
  // ADR-636 Φ2.4 (D.6) — STYLE codes belong in the POLYLINE header (before the VERTEX/SEQEND
  // sub-entities), so they bind to the polyline and not to a discarded SEQEND.
  if (style) emitEntityStyle(pair, style);
  pair(66, 1);                       // vertices-follow flag
  pair(70, closed ? 1 : 0);          // 1 = closed
  if (thickness) pair(39, thickness); // extrusion height (group 39)
  for (const v of vertices) {
    pair(0, 'VERTEX'); pair(8, layer);
    pair(10, v.x * s); pair(20, v.y * s);
  }
  pair(0, 'SEQEND'); pair(8, layer);
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
): void {
  if (vertices.length < 2) return;
  pair(0, 'LEADER');
  pair(8, layer);
  pair(62, aci);
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
