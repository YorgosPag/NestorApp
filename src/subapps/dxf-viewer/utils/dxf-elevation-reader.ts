/**
 * 🏢 DXF group codes → scene elevation fields (ADR-635 · ADR-650 M2). The ONE place the converters read Z.
 *
 * | Entity                         | Frame | Z source                                   | Scene field                    |
 * |--------------------------------|-------|--------------------------------------------|--------------------------------|
 * | LWPOLYLINE                     | OCS   | 38 (one elevation)                         | `elevation` / `vertexElevations` |
 * | POLYLINE 2D (70 bit 8 clear)   | OCS   | header point 30 (one elevation)            | `elevation` / `vertexElevations` |
 * | POLYLINE 3D (70 bit 8 set)     | WCS   | VERTEX 30 (per vertex)                     | `elevation` / `vertexElevations` |
 * | SPLINE                         | WCS   | control point 30 (per point)               | `elevation` / `vertexElevations` |
 * | LINE                           | WCS   | 30 / 31                                    | `startElevation` / `endElevation` |
 *
 * OCS entities go through `@/lib/dxf/dxf-ocs` FIRST: under a non-default extrusion (e.g. 0,0,−1 — mirrored in
 * AutoCAD) both the plan position AND the sign of Z change. A tilted plane yields a genuinely 3D polyline: the plan
 * view is its projection and every vertex gets its own Z.
 *
 * 🔑 «All zero» = 2D — the rule (and its Civil 3D / Carlson rationale) lives in `entity-elevation.ts`
 * (`classifyVertexElevations`), because block placement applies it again to the final world Z.
 */

import type { Point2D } from '../rendering/types/Types';
import { dxfOcsToWcs, dxfRealOr, isDefaultDxfExtrusion, readDxfExtrusion } from '@/lib/dxf/dxf-ocs';
import { classifyVertexElevations, type PolylineElevationFields } from './entity-elevation';

/** POLYLINE 70 bit 8 — «3D polyline»: WCS vertices, a Z per VERTEX (otherwise a 2D, OCS polyline). */
const POLYLINE_3D_FLAG = 8;

/** `true` for a 3D POLYLINE header (70 bit 8). */
export function isDxf3dPolyline(tags: Readonly<Record<string, string>>): boolean {
  return ((parseInt(tags['70'] ?? '0', 10) || 0) & POLYLINE_3D_FLAG) !== 0;
}

/**
 * A planar (OCS) polyline — LWPOLYLINE / 2D POLYLINE — to WCS plan vertices + elevation fields.
 * @param ocsVertices vertices as written in the file (10/20)
 * @param tags the record's flat tags (210/220/230 extrusion)
 * @param elevationCode `'38'` for LWPOLYLINE, `'30'` for the 2D POLYLINE header point
 */
export function readPlanarPolylineElevation(
  ocsVertices: readonly Point2D[],
  tags: Readonly<Record<string, string>>,
  elevationCode: '38' | '30',
): { readonly vertices: Point2D[]; readonly fields: PolylineElevationFields } {
  const elevation = dxfRealOr(tags[elevationCode], 0);
  const extrusion = readDxfExtrusion(tags);
  if (isDefaultDxfExtrusion(extrusion)) {
    return {
      vertices: ocsVertices.map((v) => ({ x: v.x, y: v.y })),
      fields: classifyVertexElevations(ocsVertices.map(() => elevation)),
    };
  }
  const world = ocsVertices.map((v) => dxfOcsToWcs({ x: v.x, y: v.y, z: elevation }, extrusion));
  return {
    vertices: world.map((p) => ({ x: p.x, y: p.y })),
    fields: classifyVertexElevations(world.map((p) => p.z)),
  };
}

/** A WCS polyline (3D POLYLINE / SPLINE): the per-vertex 30 (absent ⇒ 0, the DXF default). */
export function readWorldPolylineElevation(vertices: ReadonlyArray<{ readonly z?: number }>): PolylineElevationFields {
  return classifyVertexElevations(vertices.map((v) => v.z ?? 0));
}

/** LINE 30 / 31 (WCS). Both zero ⇒ a 2D line (no fields). */
export function readLineElevation(
  tags: Readonly<Record<string, string>>,
): { readonly startElevation: number; readonly endElevation: number } | Record<string, never> {
  const startElevation = dxfRealOr(tags['30'], 0);
  const endElevation = dxfRealOr(tags['31'], 0);
  return startElevation === 0 && endElevation === 0 ? {} : { startElevation, endElevation };
}
