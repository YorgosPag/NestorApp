/**
 * ADR-920 §14.12 phase Α — **what the owner SAYS about where the survey is**, as the door receives it and as the owner sees it.
 *
 *   PATCH …/terrain  { kind: 'coordinate-system', system }            «the coordinates are EPSG:2100» / «they are local»
 *                    { kind: 'location-visibility', showInListing }   «the public listing may show where the plot is»
 *   GET   …/terrain?view=georeference                                 what is declared, what the numbers suggest, and what
 *                                                                     reading them as the Greek grid would give — BEFORE declaring
 *
 * Two different questions, two kinds, two ticks — and neither is a change of the plot outline, so neither lives in
 * `PlotOutlineAmendment`. Never a coordinate, never a position: the browser names a CHOICE; the server computes the rest
 * from the bytes it already holds.
 *
 * 🔑 **The same judgement shows and decides**: {@link readAsGreekGrid} is what the owner's card displays («the plot would
 *    fall 120 m from the listing's position») and what the door enforces. A card that says «fine» while the door refuses
 *    would be worse than no card (the rule of `listing-terrain-judge.ts`).
 *
 * Pure: no I/O, imported by the browser and the server alike.
 *
 * @module lib/terrain/publication/terrain-georeference-declaration
 */

import { z } from 'zod';

import { GREEK_GRID_CRS } from '@/lib/geo/greek-grid';
import type { ListingPosition } from '@/types/public-listing';

import { crossCheckWithListing, halfDiagonalM, suggestCoordinateSystem } from './listing-terrain-georeference';
import { judgeListingTerrainSource } from './listing-terrain-judge';
import { TERRAIN_COORDINATE_SYSTEMS, withCoordinateSystem, type ListingTerrainSource } from './listing-terrain-source';
import type { TerrainRefusalCode } from './terrain-publication-contract';

/** `GET …/terrain?view=georeference` — the value of the existing `view` parameter (`OWNER_TERRAIN_VIEW_PARAM`). */
export const OWNER_TERRAIN_GEOREFERENCE_VIEW = 'georeference';

const coordinateSystem = z.enum(TERRAIN_COORDINATE_SYSTEMS);

const amendmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('coordinate-system'), system: coordinateSystem }).strict(),
  z.object({ kind: z.literal('location-visibility'), showInListing: z.boolean() }).strict(),
]);

export type TerrainGeoreferenceAmendment = z.infer<typeof amendmentSchema>;

/** The browser's JSON body → the amendment, or `null` for anything that is not exactly one (unknown keys included). */
export function parseTerrainGeoreferenceAmendment(raw: unknown): TerrainGeoreferenceAmendment | null {
  const parsed = amendmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const measured = { distanceM: z.number().finite().nonnegative(), toleranceM: z.number().finite().positive() };

/** What reading the survey as EPSG:2100 gives — the four answers, each with its own name. */
const greekGridReadingSchema = z.discriminatedUnion('kind', [
  /** Inside the area of use and within the tolerance of the listing's position. */
  z.object({ kind: z.literal('agrees'), ...measured }),
  /** Inside the area of use, but too far from where the listing says it is. */
  z.object({ kind: z.literal('far-from-listing'), ...measured }),
  /** Part of the surface is outside the registry's area of use: these are not Greek-grid coordinates. */
  z.object({ kind: z.literal('outside-area-of-use') }),
  /** The listing declares no position (declined, or never asked): nothing independent to check against. */
  z.object({ kind: z.literal('listing-position-unknown') }),
]);

export type GreekGridReading = z.infer<typeof greekGridReadingSchema>;

const statusSchema = z.object({
  /** What the owner declared; `null` = not asked yet. */
  coordinateSystem: coordinateSystem.nullable(),
  showLocationInListing: z.boolean(),
  /** What the survey's own numbers support, or `null` when they are split — a suggestion, never applied. */
  suggestion: coordinateSystem.nullable(),
  greekGrid: greekGridReadingSchema,
});

export type TerrainGeoreferenceStatus = z.infer<typeof statusSchema>;

/** The view's response: the status, or `null` when no relief was ever published (there is nothing to place). */
export function parseTerrainGeoreferenceView(raw: unknown): { readonly georeference: TerrainGeoreferenceStatus | null } | null {
  const parsed = z.object({ georeference: statusSchema.nullable() }).safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * **What would declaring EPSG:2100 give?** — the source read as the Greek grid, built by the ONE judge, checked against
 * the listing's position. `null` when the source does not build at all (the caller's fail-closed case: a published source
 * that no longer builds is not something this question can answer).
 */
export function readAsGreekGrid(source: ListingTerrainSource, position: ListingPosition): GreekGridReading | null {
  const declared = withCoordinateSystem(source, GREEK_GRID_CRS.name);
  const verdict = declared === null ? null : judgeListingTerrainSource(declared);
  if (verdict === null || !verdict.ok) return null;

  const { georeference } = verdict.snapshot;
  if (georeference === null) return { kind: 'outside-area-of-use' };
  const check = crossCheckWithListing(georeference, halfDiagonalM(verdict.snapshot), position);
  if (check.ok) return { kind: 'agrees', distanceM: check.distanceM, toleranceM: check.toleranceM };
  if (check.reason === 'listing-position-unknown') return { kind: 'listing-position-unknown' };
  return { kind: 'far-from-listing', distanceM: check.distanceM, toleranceM: check.toleranceM };
}

/** Why the door refuses a Greek-grid declaration, or `null` when the reading agrees. Exhaustive over the reading. */
export function refusalOfGreekGridReading(reading: GreekGridReading): TerrainRefusalCode | null {
  switch (reading.kind) {
    case 'agrees':
      return null;
    case 'far-from-listing':
      return 'TERRAIN_GEOREFERENCE_FAR_FROM_LISTING';
    case 'outside-area-of-use':
      return 'TERRAIN_GEOREFERENCE_OUTSIDE_AREA_OF_USE';
    case 'listing-position-unknown':
      return 'TERRAIN_GEOREFERENCE_LISTING_POSITION_UNKNOWN';
  }
}

/** Everything the owner's card shows, from the current source and the listing's position. `null` ⇔ the source does not build. */
export function terrainGeoreferenceStatusOf(source: ListingTerrainSource, position: ListingPosition): TerrainGeoreferenceStatus | null {
  const greekGrid = readAsGreekGrid(source, position);
  if (greekGrid === null) return null;
  return {
    coordinateSystem: source.coordinateSystem,
    showLocationInListing: source.showLocationInListing,
    suggestion: suggestCoordinateSystem(source.points)?.system ?? null,
    greekGrid,
  };
}
