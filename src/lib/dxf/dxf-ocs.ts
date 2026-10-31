/**
 * @fileoverview **DXF Object Coordinate System (OCS) → World (WCS)** — the ONE reading of group codes 210/220/230.
 * @related ../../subapps/dxf-viewer/utils/dxf-elevation-reader (the viewer's consumer)
 *
 * Planar DXF entities store their points in the OCS of their extrusion direction N (210/220/230, default 0,0,1); the
 * elevation (LWPOLYLINE 38, 2D POLYLINE header 30) is the OCS **Z**. Which entity is which — per the Autodesk DXF
 * Reference («Object Coordinate Systems») and each entity's group-code table, not by what «looks planar»:
 *
 *   OCS   CIRCLE · ARC · SOLID · TRACE · TEXT · ATTRIB · ATTDEF · INSERT · LWPOLYLINE · 2D POLYLINE/VERTEX · HATCH
 *   WCS   LINE · POINT · 3DFACE · 3D POLYLINE · SPLINE · ELLIPSE · XLINE · RAY · LEADER · MLINE · IMAGE · MTEXT
 *   MIXED DIMENSION — 10/13/14/15 WCS · 11/12/16 and the angles OCS
 *
 * ⚠️ ELLIPSE and MTEXT carry a 210 yet are NOT OCS: ELLIPSE's 10 + 11 are «in WCS» (the 210 is only the side its
 * parameters turn on), MTEXT's 11 is a WCS direction and its 10 is WCS too (ezdxf: «MTEXT is not an OCS entity»).
 * IMAGE is in the Reference's OCS list, but its own table says 10/11/12 «in WCS» — the table wins.
 *
 * The OCS axes come from AutoCAD's **arbitrary axis algorithm** (DXF Reference, «Arbitrary Axis Algorithm»):
 *   Az = normalize(N)
 *   Ax = normalize( (|Az.x| < 1/64 && |Az.y| < 1/64) ? Wy × Az : Wz × Az )
 *   Ay = normalize(Az × Ax)
 *   WCS = x·Ax + y·Ay + z·Az        (the OCS origin IS the WCS origin)
 *
 * ⚠️ WHY IT MATTERS FOR ELEVATIONS: N = (0,0,−1) is common (entities mirrored in AutoCAD). There Ax = (−1,0,0),
 * Ay = (0,1,0), so WCS = (−x, y, **−z**) — reading the raw 38 would give the WRONG SIGN, silently.
 *
 * Only import-free imports, on purpose: shared by the viewer and by the owner-side survey import (CHECK 3.62).
 */

import { normalizeAngleDeg } from '@/lib/geometry/angle';

export interface DxfVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The default extrusion — OCS ≡ WCS. */
export const DXF_DEFAULT_EXTRUSION: DxfVec3 = { x: 0, y: 0, z: 1 };

/** AutoCAD's «arbitrary axis» threshold (1/64). */
const ARBITRARY_AXIS_LIMIT = 1 / 64;

/** Below this, a direction is treated as the default (0,0,1) — DXF writers print ~15 significant digits. */
const DEFAULT_EXTRUSION_TOLERANCE = 1e-12;

function cross(a: DxfVec3, b: DxfVec3): DxfVec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(v: DxfVec3): DxfVec3 | null {
  const len = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(len) || len === 0) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** A DXF REAL (group codes 10–59) or `fallback` when absent / non-finite — the DXF default for a missing code. */
export function dxfRealOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Extrusion direction from a record's flat tags. Absent codes take the DXF defaults (0,0,1); a zero-length or
 * non-finite vector is malformed and falls back to the default rather than inventing an axis.
 */
export function readDxfExtrusion(tags: Readonly<Record<string, string>>): DxfVec3 {
  const raw = { x: dxfRealOr(tags['210'], 0), y: dxfRealOr(tags['220'], 0), z: dxfRealOr(tags['230'], 1) };
  return normalize(raw) ?? DXF_DEFAULT_EXTRUSION;
}

/** `true` when OCS ≡ WCS — the caller may skip the transform entirely. */
export function isDefaultDxfExtrusion(n: DxfVec3): boolean {
  return Math.abs(n.x) < DEFAULT_EXTRUSION_TOLERANCE
    && Math.abs(n.y) < DEFAULT_EXTRUSION_TOLERANCE
    && Math.abs(n.z - 1) < DEFAULT_EXTRUSION_TOLERANCE;
}

/**
 * `true` when N = (0,0,−1): the plan view sees the OCS from behind and the map is a pure reflection X → −X, so a
 * circle stays a circle. Any other non-default N tilts the plane, and a circle's plan projection is no longer one.
 */
export function isFlippedDxfExtrusion(n: DxfVec3): boolean {
  return Math.abs(n.x) < DEFAULT_EXTRUSION_TOLERANCE
    && Math.abs(n.y) < DEFAULT_EXTRUSION_TOLERANCE
    && Math.abs(n.z + 1) < DEFAULT_EXTRUSION_TOLERANCE;
}

/** `true` when the plan view (from +Z) sees the entity's back face — its OCS reads mirrored there. */
export function isDxfBackFacing(n: DxfVec3): boolean {
  return n.z < 0;
}

/**
 * An angle measured in the OCS (ARC 50/51, TEXT 50, INSERT 50, HATCH 52, DIMENSION 50) → the angle of the same
 * direction in the WCS plan view, degrees. Default extrusion: returned as written, never re-derived. A direction the
 * plan view sees end-on (a plane containing Z) has no plan angle, so the written one stands.
 */
export function dxfOcsAngleToPlanDeg(angleDeg: number, extrusion: DxfVec3): number {
  if (isDefaultDxfExtrusion(extrusion)) return angleDeg;
  if (isFlippedDxfExtrusion(extrusion)) return normalizeAngleDeg(180 - angleDeg);
  const rad = (angleDeg * Math.PI) / 180;
  const dir = dxfOcsToWcs({ x: Math.cos(rad), y: Math.sin(rad), z: 0 }, extrusion);
  if (Math.hypot(dir.x, dir.y) < DEFAULT_EXTRUSION_TOLERANCE) return angleDeg;
  return normalizeAngleDeg((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
}

/** The OCS basis (Ax, Ay, Az) of an extrusion direction — arbitrary axis algorithm. */
function dxfOcsBasis(extrusion: DxfVec3): { readonly ax: DxfVec3; readonly ay: DxfVec3; readonly az: DxfVec3 } {
  const az = normalize(extrusion) ?? DXF_DEFAULT_EXTRUSION;
  const useWorldY = Math.abs(az.x) < ARBITRARY_AXIS_LIMIT && Math.abs(az.y) < ARBITRARY_AXIS_LIMIT;
  const seed: DxfVec3 = useWorldY ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  const ax = normalize(cross(seed, az)) ?? { x: 1, y: 0, z: 0 };
  const ay = normalize(cross(az, ax)) ?? { x: 0, y: 1, z: 0 };
  return { ax, ay, az };
}

/** One OCS point → WCS. The origins coincide, so a direction vector maps through the same call. */
export function dxfOcsToWcs(point: DxfVec3, extrusion: DxfVec3): DxfVec3 {
  if (isDefaultDxfExtrusion(extrusion)) return point;
  const { ax, ay, az } = dxfOcsBasis(extrusion);
  return {
    x: point.x * ax.x + point.y * ay.x + point.z * az.x,
    y: point.x * ax.y + point.y * ay.y + point.z * az.y,
    z: point.x * ax.z + point.y * ay.z + point.z * az.z,
  };
}
