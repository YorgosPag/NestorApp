/**
 * ADR-920 Β3 — the survey SOURCE a plot listing is published from: the wire contract between the two
 * entry doors (owner form Β4, DXF Viewer Β5) and the ONE server door.
 *
 *   browser: CSV / Excel / DXF ─(existing parsers)─▶ ListingTerrainSource (JSON)
 *   server:  parseListingTerrainSource ─▶ buildListingTerrainSnapshot  (never trusts a client snapshot)
 *
 * Three rules:
 *   1. **The server rebuilds everything.** The client sends measurements only — points, breaklines,
 *      boundary, footprint. A snapshot, a contour or a slope from the browser would be a claim, not a fact.
 *   2. **Only what the derivative needs.** No point codes, no point numbers, no layer names: the source
 *      stays PRIVATE (ADR-920 Δ2), but even the private copy keeps nothing the terrain does not use.
 *   3. **One canonical form.** Whatever was accepted is re-serialised by {@link encodeListingTerrainSource}
 *      — integer millimetres, fixed key order — and THAT is what is stored. The raw client string is
 *      never kept: it could carry fields nobody validated.
 *
 * A point without elevation is `[x, y]` and stays WITHOUT `z` — never `0` (ADR-720): the TIN builder
 * keeps such points out of the surface through `surfacePointsOf`.
 *
 * Pure: no I/O, imported by the browser and the server alike.
 *
 * @module lib/terrain/publication/listing-terrain-source
 */

import { z } from 'zod';

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { Breakline, TopoPoint, TopoPoint3D } from '@/lib/terrain/terrain-types';
import {
  LISTING_TERRAIN_SOURCE_MAX_ABS_MM,
  LISTING_TERRAIN_SOURCE_MAX_BREAKLINES,
  LISTING_TERRAIN_SOURCE_MAX_POINTS,
  LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES,
} from './listing-terrain-config';
import type { ListingTerrainInput } from './listing-terrain-types';

/** Bumped on any breaking change of the source shape; the door refuses versions it does not know. */
export const LISTING_TERRAIN_SOURCE_VERSION = 1 as const;

/** `[x, y]` (no elevation) or `[x, y, z]` — WORLD canonical mm. */
export type TerrainSourcePoint = readonly [number, number] | readonly [number, number, number];
export type TerrainSourceVertex = readonly [number, number, number];
export type TerrainSourcePlanar = readonly [number, number];

export interface TerrainSourceBreakline {
  readonly closed: boolean;
  readonly vertices: readonly TerrainSourceVertex[];
}

export interface ListingTerrainSource {
  readonly version: typeof LISTING_TERRAIN_SOURCE_VERSION;
  readonly points: readonly TerrainSourcePoint[];
  readonly breaklines: readonly TerrainSourceBreakline[];
  /** Plot boundary ring (implicitly closed), or `null` to publish the surface as surveyed. */
  readonly boundary: readonly TerrainSourcePlanar[] | null;
  /** Buildable footprint (setback engine) + DECLARED numeric height; `null` ⇒ no envelope. */
  readonly envelope: {
    readonly footprint: readonly TerrainSourcePlanar[];
    readonly maxHeightM: number | null;
  } | null;
}

const coordinate = z.number().finite().min(-LISTING_TERRAIN_SOURCE_MAX_ABS_MM).max(LISTING_TERRAIN_SOURCE_MAX_ABS_MM);
const planar = z.tuple([coordinate, coordinate]);
const vertex = z.tuple([coordinate, coordinate, coordinate]);
const ring = z.array(planar).min(3).max(LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES);

const sourceSchema = z.object({
  version: z.literal(LISTING_TERRAIN_SOURCE_VERSION),
  points: z.array(z.union([vertex, planar])).min(1).max(LISTING_TERRAIN_SOURCE_MAX_POINTS),
  breaklines: z
    .array(z.object({ closed: z.boolean(), vertices: z.array(vertex).min(2).max(LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES) }))
    .max(LISTING_TERRAIN_SOURCE_MAX_BREAKLINES),
  boundary: ring.nullable(),
  envelope: z
    .object({ footprint: ring, maxHeightM: z.number().finite().positive().max(1000).nullable() })
    .nullable(),
});

/** Integer millimetres, `-0` folded — the survey's own precision, and one spelling per value. */
function mm(value: number): number {
  return Math.round(value) + 0;
}

/** Centimetres for the declared height (metres), `-0` folded. */
function cm(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

function canonicalPoint(point: readonly number[]): TerrainSourcePoint {
  return point.length === 3 ? [mm(point[0]), mm(point[1]), mm(point[2])] : [mm(point[0]), mm(point[1])];
}

function canonicalPlanar([x, y]: readonly [number, number]): TerrainSourcePlanar {
  return [mm(x), mm(y)];
}

function canonicalVertex([x, y, z]: readonly [number, number, number]): TerrainSourceVertex {
  return [mm(x), mm(y), mm(z)];
}

/**
 * The accepted source in canonical form, or `null` for anything else — wrong version, non-finite or
 * out-of-range numbers, rings under three vertices, unknown shapes. Never a default: a source that does
 * not parse is not a survey.
 */
export function parseListingTerrainSource(raw: unknown): ListingTerrainSource | null {
  const parsed = sourceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { points, breaklines, boundary, envelope } = parsed.data;

  return {
    version: LISTING_TERRAIN_SOURCE_VERSION,
    points: points.map(canonicalPoint),
    breaklines: breaklines.map((line) => ({ closed: line.closed, vertices: line.vertices.map(canonicalVertex) })),
    boundary: boundary === null ? null : boundary.map(canonicalPlanar),
    envelope: envelope === null ? null : {
      footprint: envelope.footprint.map(canonicalPlanar),
      maxHeightM: envelope.maxHeightM === null ? null : cm(envelope.maxHeightM),
    },
  };
}

/**
 * The ONE serialisation of a source — what the door stores. Keys are written in a fixed order by
 * construction, so equal sources give equal bytes.
 */
export function encodeListingTerrainSource(source: ListingTerrainSource): string {
  return JSON.stringify({
    version: source.version,
    points: source.points,
    breaklines: source.breaklines.map((line) => ({ closed: line.closed, vertices: line.vertices })),
    boundary: source.boundary,
    envelope: source.envelope === null ? null : { footprint: source.envelope.footprint, maxHeightM: source.envelope.maxHeightM },
  });
}

function toTopoPoint(point: TerrainSourcePoint): TopoPoint {
  return point.length === 3 ? { x: point[0], y: point[1], z: point[2] } : { x: point[0], y: point[1] };
}

function toPlanar([x, y]: TerrainSourcePlanar): PlanarPoint {
  return { x, y };
}

function toBreakline(line: TerrainSourceBreakline, index: number): Breakline {
  const vertices: TopoPoint3D[] = line.vertices.map(([x, y, z]) => ({ x, y, z }));
  // Positional id: the source has no identities of its own, and the builder only needs uniqueness.
  return { id: `breakline-${index}`, vertices, closed: line.closed };
}

/** The source → the snapshot builder's input (ADR-920 Β2). Same frame: WORLD canonical mm. */
export function toListingTerrainInput(source: ListingTerrainSource): ListingTerrainInput {
  return {
    points: source.points.map(toTopoPoint),
    breaklines: source.breaklines.map(toBreakline),
    boundaryWorldMm: source.boundary === null ? null : source.boundary.map(toPlanar),
    envelope: source.envelope === null ? null : {
      footprintWorldMm: source.envelope.footprint.map(toPlanar),
      maxHeightM: source.envelope.maxHeightM,
    },
  };
}
