/**
 * @fileoverview **«Same position, different elevation»** — ONE definition for the publication facts and for the column
 * sniffer (ADR-920 §13.3 · §13.10 Α).
 * @related ./survey-upload-preparation (the owner is told the facts) · ./topo-column-sniffer (which column is Z? — the one
 *   that does NOT make the surface contradict itself)
 *
 * Moved here, unchanged, from `survey-upload-preparation` so that the sniffer can ask the same question without pulling
 * the judge and the encoder into the DXF viewer. A surface is a function z(x, y): a position stated twice with two
 * elevations is a contradiction in the measurement — or, when the columns are read in the wrong order, the symptom.
 *
 * Positions are compared EXACTLY as given. The publication passes canonical integer mm (exactly what the TIN merges); the
 * sniffer passes the file's own numbers, before any unit is known. Pure.
 */

import type { TerrainSourcePoint } from '../publication/listing-terrain-source';

/** What the owner is told about the points, refused or not. Counts are over the CANONICAL (integer-mm) points. */
export interface SurveyFacts {
  readonly points: number;
  /** Points carrying a measured elevation — only these shape the surface (ADR-720). */
  readonly withElevation: number;
  /** Extra points sitting on an already-taken position: the surface keeps the first. */
  readonly coincident: number;
  /** Of those, the ones whose elevation DIFFERS from the kept point — a contradiction in the survey. */
  readonly conflictingElevations: number;
}

/** One position: the elevation the TIN keeps (the FIRST) and how the repeats relate to it. */
export interface PositionCensus {
  readonly x: number;
  readonly y: number;
  readonly keptZ: number | undefined;
  repeats: number;
  conflicts: number;
}

/** ONE pass over the points: «same position» is exact equality of the two given numbers. */
export function censusOf(points: readonly TerrainSourcePoint[]): { withElevation: number; positions: Map<string, PositionCensus> } {
  const positions = new Map<string, PositionCensus>();
  let withElevation = 0;
  for (const point of points) {
    const z = point.length === 3 ? point[2] : undefined;
    if (z !== undefined) withElevation++;
    const key = `${point[0]}:${point[1]}`;
    const seen = positions.get(key);
    if (seen === undefined) { positions.set(key, { x: point[0], y: point[1], keptZ: z, repeats: 0, conflicts: 0 }); continue; }
    seen.repeats++;
    if (seen.keptZ !== z) seen.conflicts++;
  }
  return { withElevation, positions };
}

/** Facts over the points (see {@link censusOf}). */
export function surveyFactsOf(points: readonly TerrainSourcePoint[]): SurveyFacts {
  const { withElevation, positions } = censusOf(points);
  let coincident = 0;
  let conflictingElevations = 0;
  for (const position of positions.values()) {
    coincident += position.repeats;
    conflictingElevations += position.conflicts;
  }
  return { points: points.length, withElevation, coincident, conflictingElevations };
}
