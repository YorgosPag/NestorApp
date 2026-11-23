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
 * v2 (ADR-920 §14.11 Ζ2) adds the plot outline from the surveyor's drawing. Its ONE writer is {@link withPlotOutline};
 * the server door fills it in from the owner's confirmed outline (Ζ3) — an outline a browser sends with the survey is
 * not a confirmation.
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

/**
 * Bumped on any breaking change of the source shape; the door refuses versions it does not know.
 * History: 1 = Β3 · 2 = Β6.11 Ζ2 (`plotOutline`).
 */
export const LISTING_TERRAIN_SOURCE_VERSION = 2 as const;

/** The previous shape, still READ: a v1 source is a v2 source without a plot outline (ADR-920 §14.11 Ζ2). */
export const LISTING_TERRAIN_SOURCE_LEGACY_VERSION = 1 as const;

/**
 * Who a derivative is built for (ADR-920 §14.11 Π9). The owner's preview always shows the plot outline; the PUBLIC
 * listing shows it only when the owner said so — the shape of a plot finds it on the public cadastre map (Δ3).
 */
export type ListingTerrainAudience = 'owner' | 'public';

/** `[x, y]` (no elevation) or `[x, y, z]` — WORLD canonical mm. */
export type TerrainSourcePoint = readonly [number, number] | readonly [number, number, number];
export type TerrainSourceVertex = readonly [number, number, number];
export type TerrainSourcePlanar = readonly [number, number];

export interface TerrainSourceBreakline {
  readonly closed: boolean;
  readonly vertices: readonly TerrainSourceVertex[];
}

/**
 * ADR-920 §14.11 Π1 — the plot outline taken from the surveyor's DRAWING (DXF / PDF coordinate table). It is drawn on
 * the relief and clips nothing — the clip is {@link ListingTerrainSource.boundary}, a different idea (Civil 3D).
 */
export interface TerrainSourcePlotOutline {
  /** Implicitly closed ring, arcs already tessellated — WORLD canonical mm. */
  readonly ring: readonly TerrainSourcePlanar[];
  /** Π9 — in the PUBLIC listing only when the owner ticked it. The owner's own preview shows it regardless. */
  readonly showInListing: boolean;
}

/** What {@link withPlotOutline} receives — the Ζ1 candidate's ring as it comes, plus the owner's choice (Π9). */
export interface PlotOutlineChoice {
  readonly ringWorldMm: readonly PlanarPoint[];
  readonly showInListing: boolean;
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
  /** The plot outline drawn on the relief, or `null`. Written ONLY through {@link withPlotOutline}. */
  readonly plotOutline: TerrainSourcePlotOutline | null;
}

const coordinate = z.number().finite().min(-LISTING_TERRAIN_SOURCE_MAX_ABS_MM).max(LISTING_TERRAIN_SOURCE_MAX_ABS_MM);
const planar = z.tuple([coordinate, coordinate]);
const vertex = z.tuple([coordinate, coordinate, coordinate]);
const ring = z.array(planar).min(3).max(LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES);

/** The fields both versions share. */
const sharedShape = {
  points: z.array(z.union([vertex, planar])).min(1).max(LISTING_TERRAIN_SOURCE_MAX_POINTS),
  breaklines: z
    .array(z.object({ closed: z.boolean(), vertices: z.array(vertex).min(2).max(LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES) }))
    .max(LISTING_TERRAIN_SOURCE_MAX_BREAKLINES),
  boundary: ring.nullable(),
  envelope: z
    .object({ footprint: ring, maxHeightM: z.number().finite().positive().max(1000).nullable() })
    .nullable(),
};

const sourceSchema = z.discriminatedUnion('version', [
  z.object({ version: z.literal(LISTING_TERRAIN_SOURCE_LEGACY_VERSION), ...sharedShape }),
  z.object({
    version: z.literal(LISTING_TERRAIN_SOURCE_VERSION),
    ...sharedShape,
    plotOutline: z.object({ ring, showInListing: z.boolean() }).nullable(),
  }),
]);

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
 * not parse is not a survey. A v1 source is read as v2 with `plotOutline: null` — the version says so, nothing is guessed.
 */
export function parseListingTerrainSource(raw: unknown): ListingTerrainSource | null {
  const parsed = sourceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { points, breaklines, boundary, envelope } = parsed.data;
  const plotOutline = parsed.data.version === LISTING_TERRAIN_SOURCE_LEGACY_VERSION ? null : parsed.data.plotOutline;

  return {
    version: LISTING_TERRAIN_SOURCE_VERSION,
    points: points.map(canonicalPoint),
    breaklines: breaklines.map((line) => ({ closed: line.closed, vertices: line.vertices.map(canonicalVertex) })),
    boundary: boundary === null ? null : boundary.map(canonicalPlanar),
    envelope: envelope === null ? null : {
      footprint: envelope.footprint.map(canonicalPlanar),
      maxHeightM: envelope.maxHeightM === null ? null : cm(envelope.maxHeightM),
    },
    plotOutline: plotOutline === null ? null : {
      ring: plotOutline.ring.map(canonicalPlanar),
      showInListing: plotOutline.showInListing,
    },
  };
}

/**
 * ADR-920 §14.11 Π2 — **the ONE writer of the plot outline**: the source with `outline` in it (or removed, with `null`).
 * It goes through the SAME schema and canonical form as anything the door accepts, so the outline is bounded, rounded to
 * the millimetre and stored in v2 like the rest — `null` when the ring is not one the contract accepts (fewer than three
 * vertices, non-finite or out-of-range numbers, too many vertices). Pure: the door decides when it is called (Ζ3).
 */
export function withPlotOutline(source: ListingTerrainSource, outline: PlotOutlineChoice | null): ListingTerrainSource | null {
  return parseListingTerrainSource({
    ...source,
    version: LISTING_TERRAIN_SOURCE_VERSION,
    plotOutline: outline === null ? null : {
      ring: outline.ringWorldMm.map((p) => [p.x, p.y]),
      showInListing: outline.showInListing,
    },
  });
}

/**
 * ADR-920 §14.11 Ζ3c — **the outline a source already carries, as `withPlotOutline` takes it** (or `null`). The inverse
 * road, so an outline is CARRIED from one relief to the next (copy semantics) instead of being re-derived from a drawing
 * that may since have gone to the trash. `withPlotOutline(s, plotOutlineChoiceIn(s))` gives `s` back: the ring is already
 * canonical, and canonicalising it again changes nothing.
 */
export function plotOutlineChoiceIn(source: ListingTerrainSource): PlotOutlineChoice | null {
  const outline = source.plotOutline;
  if (outline === null) return null;
  return { ringWorldMm: outline.ring.map(toPlanar), showInListing: outline.showInListing };
}

/**
 * ADR-920 §14.11 Ζ4 — **is this the same ring?** Compared in the canonical millimetre `withPlotOutline` stores, so a drawing's
 * ring (raw WORLD mm) and the ring a source carries (already rounded) are judged on the same spelling — never a float tolerance.
 */
export function samePlotOutlineRing(a: readonly PlanarPoint[], b: readonly PlanarPoint[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => mm(p.x) === mm(b[i].x) && mm(p.y) === mm(b[i].y));
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
    plotOutline: source.plotOutline === null ? null : {
      ring: source.plotOutline.ring,
      showInListing: source.plotOutline.showInListing,
    },
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

/** Π9 — the outline the given audience may see: the owner always, the public only when the owner ticked it. */
function plotOutlineFor(source: ListingTerrainSource, audience: ListingTerrainAudience): PlanarPoint[] | null {
  const outline = source.plotOutline;
  if (outline === null || (audience === 'public' && !outline.showInListing)) return null;
  return outline.ring.map(toPlanar);
}

/**
 * The source → the snapshot builder's input (ADR-920 Β2). Same frame: WORLD canonical mm. `audience` has no default on
 * purpose: every caller states who the derivative is for (the shelf's bake = `'public'`, the owner's verdict = `'owner'`).
 */
export function toListingTerrainInput(source: ListingTerrainSource, audience: ListingTerrainAudience): ListingTerrainInput {
  return {
    plotOutlineWorldMm: plotOutlineFor(source, audience),
    points: source.points.map(toTopoPoint),
    breaklines: source.breaklines.map(toBreakline),
    boundaryWorldMm: source.boundary === null ? null : source.boundary.map(toPlanar),
    envelope: source.envelope === null ? null : {
      footprintWorldMm: source.envelope.footprint.map(toPlanar),
      maxHeightM: source.envelope.maxHeightM,
    },
  };
}
