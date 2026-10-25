/**
 * 🏢 Entity elevation SSoT — «what is the Z of each vertex of this linear entity?» (ADR-635 · ADR-650 M2 · ADR-462).
 *
 * The scene is planimetric (`Point2D`), and Z rides BESIDE the geometry in three optional shapes:
 *   • `PolylineEntity` / `LWPolylineEntity` `.elevation`        — one Z for all vertices (2.5D: LWPOLYLINE 38)
 *   • `PolylineEntity.vertexElevations`                          — per-vertex Z (3D POLYLINE / SPLINE)
 *   • `LineEntity.startElevation` / `.endElevation`              — LINE 30 / 31
 *
 * Every consumer asks HERE (never `isLWPolylineEntity(e) ? e.elevation`), so a new shape is taught once.
 *
 * Fail-closed: a per-vertex array whose length no longer matches `vertices` (an edit added/removed a vertex) or that
 * holds a non-finite value means «no elevation» — never a re-aligned or invented Z. The caller then falls back to
 * whatever it does for a 2D line (breaklines: proximity, declared).
 *
 * 🔑 «All zero» = no elevation. A DXF code that is absent defaults to 0, so a flat drawing and a drawing «at
 * elevation 0» are indistinguishable in the file. Civil 3D calls such lines proximity breaklines («2D polylines with
 * elevations of 0») and Carlson offers «Ignore Zero Elevations» for the same reason. Applied to the FINAL world Z
 * (after OCS and block placement), never to an intermediate frame. A line with SOME zero vertices keeps them.
 */

import type { Entity } from '../types/entities';
import { isLineEntity, isLWPolylineEntity, isPolylineEntity } from '../types/entities';

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Relative tolerance under which per-vertex Zs collapse to ONE elevation (DXF reals print ~15 digits). */
const UNIFORM_TOLERANCE = 1e-9;

/** Polyline-shaped elevation fields (exclusive: one elevation, per-vertex, or none). */
export type PolylineElevationFields =
  | { readonly elevation: number; readonly vertexElevations?: never }
  | { readonly vertexElevations: number[]; readonly elevation?: never }
  | Record<string, never>;

/** The elevation fields a linear entity may carry. */
export interface EntityElevationFields {
  elevation?: number;
  vertexElevations?: number[];
  startElevation?: number;
  endElevation?: number;
}

const ELEVATION_KEYS: ReadonlyArray<keyof EntityElevationFields> =
  ['elevation', 'vertexElevations', 'startElevation', 'endElevation'];

/** World Zs → the scene shape: none (all zero / invalid), one elevation, or per-vertex. */
export function classifyVertexElevations(zs: readonly number[]): PolylineElevationFields {
  if (zs.length === 0 || !zs.every(Number.isFinite)) return {};
  if (zs.every((z) => z === 0)) return {};
  const first = zs[0]!;
  const tolerance = UNIFORM_TOLERANCE * Math.max(1, Math.abs(first));
  if (zs.every((z) => Math.abs(z - first) <= tolerance)) return { elevation: first };
  return { vertexElevations: [...zs] };
}

/** The Z of each vertex, in the entity's own vertex order — or `null` when the entity carries no (valid) elevation. */
export function entityVertexElevations(entity: Entity): readonly number[] | null {
  if (isLineEntity(entity)) {
    const { startElevation: z0, endElevation: z1 } = entity;
    return isFiniteNumber(z0) && isFiniteNumber(z1) ? [z0, z1] : null;
  }
  if (isPolylineEntity(entity)) {
    const zs = entity.vertexElevations;
    if (zs !== undefined) {
      return zs.length === entity.vertices.length && zs.every(isFiniteNumber) ? [...zs] : null;
    }
    return uniform(entity.elevation, entity.vertices.length);
  }
  if (isLWPolylineEntity(entity)) return uniform(entity.elevation, entity.vertices.length);
  return null;
}

function uniform(z: number | undefined, count: number): readonly number[] | null {
  return isFiniteNumber(z) ? new Array<number>(count).fill(z) : null;
}

/**
 * The elevation fields scaled by `factor` — for a UNIT conversion (ADR-462 canonical-mm import), where Z is a length in
 * the same unit as X/Y and MUST scale with them (a metre file's `38 = 1.0` is 1000 mm, not 1 mm).
 * Returns only the fields the entity has; `{}` for an entity without elevation.
 *
 * ⚠️ NOT for the user's planimetric SCALE command: that one leaves Z alone (ADR-635 decision 2026-10-25).
 */
export function scaledElevationFields(entity: Entity, factor: number): EntityElevationFields {
  if (isLineEntity(entity)) {
    const out: EntityElevationFields = {};
    if (isFiniteNumber(entity.startElevation)) out.startElevation = entity.startElevation * factor;
    if (isFiniteNumber(entity.endElevation)) out.endElevation = entity.endElevation * factor;
    return out;
  }
  if (isPolylineEntity(entity)) {
    const out: EntityElevationFields = {};
    if (isFiniteNumber(entity.elevation)) out.elevation = entity.elevation * factor;
    if (entity.vertexElevations) out.vertexElevations = entity.vertexElevations.map((z) => z * factor);
    return out;
  }
  if (isLWPolylineEntity(entity) && isFiniteNumber(entity.elevation)) return { elevation: entity.elevation * factor };
  return {};
}

/** `fields` laid onto a linear entity's shape (a line takes start/end; a polyline one elevation or per-vertex). */
function fieldsForEntity(entity: Entity, fields: PolylineElevationFields): EntityElevationFields {
  const zs = 'vertexElevations' in fields && fields.vertexElevations ? fields.vertexElevations : null;
  const z = 'elevation' in fields && isFiniteNumber(fields.elevation) ? fields.elevation : null;
  if (isLineEntity(entity)) {
    if (zs) return { startElevation: zs[0], endElevation: zs[1] };
    return z === null ? {} : { startElevation: z, endElevation: z };
  }
  if (isPolylineEntity(entity)) return zs ? { vertexElevations: zs } : z === null ? {} : { elevation: z };
  // LWPOLYLINE is 2.5D by type — an affine Z map keeps a uniform Z uniform, so `zs` cannot occur here.
  return z === null ? {} : { elevation: z };
}

/**
 * The entity with every vertex Z passed through `mapZ` — for a PLACEMENT (DXF block INSERT:
 * `z' = insertZ + sz · (z − baseZ)`). An entity without elevation counts as Z = 0 everywhere (the DXF default), so a
 * flat block inserted at Z = 5 lands at 5; the «all zero» rule is applied to the RESULT. Non-linear entities pass
 * through unchanged. Stale elevation keys are removed, never left `undefined` (persisted scenes reject `undefined`).
 */
export function withPlacedElevation<T extends Entity>(entity: T, mapZ: (z: number) => number): T {
  if (!isLineEntity(entity) && !isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return entity;
  const count = isLineEntity(entity) ? 2 : entity.vertices.length;
  const zs = entityVertexElevations(entity) ?? new Array<number>(count).fill(0);
  const placed = fieldsForEntity(entity, classifyVertexElevations(zs.map(mapZ)));
  const stripped: Record<string, unknown> = { ...entity };
  for (const key of ELEVATION_KEYS) delete stripped[key];
  return { ...stripped, ...placed } as T;
}
