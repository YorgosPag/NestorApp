/**
 * DXF ASCII — the vertex-path emitter: old-style `POLYLINE` (AutoCAD) or exploded `LINE`s (Tekton).
 *
 * Extracted from `dxf-ascii-primitive-emitters.ts` (file-size SRP, N.7.1) when the path learned
 * elevation and arcs — the EXACT inverse of the import (`utils/dxf-elevation-reader.ts`,
 * `utils/dxf-polyline-vertex-collector.ts`), so a drawing survives import → export → import:
 *
 * | Scene                         | DXF written                                                         |
 * |-------------------------------|---------------------------------------------------------------------|
 * | no Z (absent / all zero)      | 2D POLYLINE — byte-identical to the pre-elevation output            |
 * | one `elevation` (2.5D)        | 2D POLYLINE, header point `10 0 / 20 0 / 30 z` (the polyline elevation) |
 * | `vertexElevations` (per vertex) | 3D POLYLINE: `70` bit 8, `AcDb3dPolyline`, VERTEX `70 32` + `30 z` (WCS) |
 * | `bulges` (DXF 42)             | VERTEX `42` on the 2D polyline (arc of the OUTGOING segment)        |
 *
 * Z is a length in the SAME unit as X/Y (the import scales it with them, ADR-462) ⇒ it is scaled by the
 * coordinate factor `s` — never by `mmScale`, which is for the mm-only BIM fields (thickness, rebar Z).
 *
 * A 3D POLYLINE carries neither arcs nor thickness (AutoCAD DXF reference; ezdxf `Polyline3d`):
 *   • arcs are densified through the bulge SSoT with Z interpolated along the arc — true geometry, not a chord;
 *   • thickness (39) is dropped (AutoCAD extrudes 2D polylines only).
 * Tekton (`explode`) stays 2D by contract (its parser reads no Z), but its arcs are tessellated — a chord was a lie.
 *
 * @see utils/entity-elevation — the elevation SSoT (`classifyVertexElevations`)
 * @see rendering/entities/shared/geometry-bulge-utils — the bulge SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Pair } from './dxf-ascii-hatch-writer';
import { classifyVertexElevations } from '../../utils/entity-elevation';
import {
  bulgeToPolyline, expandPolyline, hasAnyBulge, isStraightSegment,
} from '../../rendering/entities/shared/geometry-bulge-utils';
import {
  emitAcDbEntity, emitEntityStyle, emitLine, emitSubEntity,
  type EntityR2018, type EntityStyleCodes,
} from './dxf-ascii-primitive-emitters';

/** POLYLINE 70 bit 8 — «3D polyline» (the same flag the import reads in `isDxf3dPolyline`). */
const POLYLINE_3D_FLAG = 8;
/** VERTEX 70 bit 32 — «3D polyline vertex». */
const VERTEX_3D_FLAG = 32;

/** The optional shape a path carries beside its plan vertices. */
export interface PathShape {
  /** Per-segment arc factor (DXF 42), index-aligned with the vertices. */
  readonly bulges?: readonly number[];
  /** Per-vertex Z in SCENE units (as `entityVertexElevations` returns it); `null` = 2D. */
  readonly zs?: readonly number[] | null;
}

/** Everything the POLYLINE header + VERTEX writers share. */
interface PathCtx {
  readonly layer: string;
  readonly aci: number;
  readonly s: number;
  readonly pair: Pair;
  readonly style?: EntityStyleCodes;
  readonly r2018?: EntityR2018;
}

/**
 * Emit a vertex path — as a single `POLYLINE` (AutoCAD) or, when `explode`,
 * as individual `LINE` segments (Tekton has no POLYLINE).
 */
export function emitPath(
  vertices: readonly Point2D[], closed: boolean, layer: string, aci: number, s: number, explode: boolean, pair: Pair,
  thickness = 0, style?: EntityStyleCodes, r2018?: EntityR2018, shape?: PathShape,
): void {
  if (vertices.length < 2) return;
  if (explode) {
    emitExplodedPath(vertices, closed, shape?.bulges, layer, aci, s, pair);
    return;
  }
  const ctx: PathCtx = { layer, aci, s, pair, style, r2018 };
  const fields = shape?.zs ? classifyVertexElevations(shape.zs) : {};
  if ('vertexElevations' in fields && fields.vertexElevations) {
    emit3dPolyline(vertices, closed, shape?.bulges, fields.vertexElevations, ctx);
    return;
  }
  const elevation = 'elevation' in fields ? fields.elevation : undefined;
  emit2dPolyline(vertices, closed, shape?.bulges, thickness, elevation, ctx);
}

/** Tekton: LINE segments, arcs tessellated through the bulge SSoT, no Z. */
function emitExplodedPath(
  vertices: readonly Point2D[], closed: boolean, bulges: readonly number[] | undefined,
  layer: string, aci: number, s: number, pair: Pair,
): void {
  if (hasAnyBulge(bulges)) {
    const pts = expandPolyline(vertices, bulges, closed);
    for (let i = 0; i < pts.length - 1; i += 1) emitLine(pts[i], pts[i + 1], layer, aci, s, pair);
    return;
  }
  for (let i = 0; i < vertices.length - 1; i += 1) {
    emitLine(vertices[i], vertices[i + 1], layer, aci, s, pair);
  }
  if (closed && vertices.length > 2) {
    emitLine(vertices[vertices.length - 1], vertices[0], layer, aci, s, pair);
  }
}

/** The POLYLINE header up to (not incl.) the flags: entity block, subclass, vertices-follow. */
function emitPolylineHead(subclass: 'AcDb2dPolyline' | 'AcDb3dPolyline', ctx: PathCtx): void {
  const { pair, layer, aci, style, r2018 } = ctx;
  pair(0, 'POLYLINE');
  if (r2018) { emitAcDbEntity(pair, layer, aci, r2018); pair(100, subclass); }
  else { pair(8, layer); pair(62, aci); if (style) emitEntityStyle(pair, style); }
  pair(66, 1);                       // vertices-follow flag
}

function emitSeqend(ctx: PathCtx): void {
  ctx.pair(0, 'SEQEND');
  if (ctx.r2018) emitSubEntity(ctx.pair, ctx.layer, ctx.r2018.owner);
  else ctx.pair(8, ctx.layer);
}

/**
 * Old-style 2D POLYLINE (R12-native, universally readable). With `thickness`, AutoCAD extrudes the
 * closed polyline along +Z → pseudo-3D prism. `elevation` (scene units) rides on the header point Z.
 */
function emit2dPolyline(
  vertices: readonly Point2D[], closed: boolean, bulges: readonly number[] | undefined,
  thickness: number, elevation: number | undefined, ctx: PathCtx,
): void {
  const { pair, layer, s, r2018 } = ctx;
  emitPolylineHead('AcDb2dPolyline', ctx);
  // Header «dummy» point: X = Y = 0, Z = the polyline elevation (OCS) — read back by the import.
  if (elevation !== undefined) { pair(10, 0); pair(20, 0); pair(30, elevation * s); }
  pair(70, closed ? 1 : 0);          // 1 = closed
  if (thickness) pair(39, thickness); // extrusion height (group 39)
  const lastArc = closed ? vertices.length : vertices.length - 1;
  vertices.forEach((v, i) => {
    pair(0, 'VERTEX');
    if (r2018) { emitSubEntity(pair, layer, r2018.owner); pair(100, 'AcDbVertex'); pair(100, 'AcDb2dVertex'); }
    else pair(8, layer);
    pair(10, v.x * s); pair(20, v.y * s);
    if (r2018) pair(30, 0);
    const bulge = i < lastArc ? bulges?.[i] : undefined;
    if (!isStraightSegment(bulge)) pair(42, bulge as number);
  });
  emitSeqend(ctx);
}

/** 3D POLYLINE — WCS vertices, a Z per VERTEX. Arcs densified (a 3D polyline has none); no thickness. */
function emit3dPolyline(
  vertices: readonly Point2D[], closed: boolean, bulges: readonly number[] | undefined,
  zs: readonly number[], ctx: PathCtx,
): void {
  const { pair, layer, s, r2018 } = ctx;
  const path = hasAnyBulge(bulges) ? densifyElevatedPath(vertices, bulges, closed, zs) : { points: vertices, zs };
  emitPolylineHead('AcDb3dPolyline', ctx);
  pair(10, 0); pair(20, 0); pair(30, 0); // header «dummy» point (always 0 for a 3D polyline)
  pair(70, (closed ? 1 : 0) | POLYLINE_3D_FLAG);
  path.points.forEach((v, i) => {
    pair(0, 'VERTEX');
    if (r2018) { emitSubEntity(pair, layer, r2018.owner); pair(100, 'AcDbVertex'); pair(100, 'AcDb3dPolylineVertex'); }
    else pair(8, layer);
    pair(10, v.x * s); pair(20, v.y * s); pair(30, path.zs[i]! * s);
    pair(70, VERTEX_3D_FLAG);
  });
  emitSeqend(ctx);
}

/**
 * Arc segments → chords via the bulge SSoT, with Z linear in the arc parameter (the tessellation is uniform in
 * angle, hence in arc length). A closed path does NOT repeat its first point — the closed flag draws that segment.
 */
export function densifyElevatedPath(
  vertices: readonly Point2D[], bulges: readonly number[] | undefined, closed: boolean, zs: readonly number[],
): { readonly points: Point2D[]; readonly zs: number[] } {
  const points: Point2D[] = [];
  const outZ: number[] = [];
  const n = vertices.length;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % n;
    const arc = bulgeToPolyline(vertices[i], vertices[j], bulges?.[i] ?? 0);
    const steps = arc.length - 1;
    for (let k = 0; k < steps; k += 1) {
      points.push(arc[k]);
      outZ.push(zs[i]! + ((zs[j]! - zs[i]!) * k) / steps);
    }
  }
  if (!closed) { points.push({ ...vertices[n - 1] }); outZ.push(zs[n - 1]!); }
  return { points, zs: outZ };
}
