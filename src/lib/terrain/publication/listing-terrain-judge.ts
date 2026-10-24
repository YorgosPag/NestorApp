/**
 * @fileoverview **THE verdict on a terrain source — one function, on the server AND in the browser** (ADR-920 §13.3).
 * @related ./listing-terrain-source (shape + canonical form) · ./listing-terrain-snapshot (the builder) ·
 *   ./terrain-publication-contract (the closed list of codes) · `api/properties/[id]/terrain` (the door)
 *
 * The door used to parse the source and dry-run the builder inline. The owner's import (ADR-920 Β4) must show the
 * SAME verdict before anything is sent — a preview that says «fine» while the server says `TERRAIN_TOO_DENSE` is
 * worse than no preview. So the judgement lives here, in the derivation home of CHECK 3.105 (`src/lib/terrain/`),
 * and both call it. It never publishes: what becomes public is baked by the shelf, from the server's own copy.
 */

import { buildListingTerrainSnapshot } from './listing-terrain-snapshot';
import { parseListingTerrainSource, toListingTerrainInput, type ListingTerrainSource } from './listing-terrain-source';
import { refusalOfTerrainRejection, type TerrainRefusalCode } from './terrain-publication-contract';
import type { ListingTerrainSnapshot } from './listing-terrain-types';

export type ListingTerrainVerdict =
  | { readonly ok: true; readonly source: ListingTerrainSource; readonly snapshot: ListingTerrainSnapshot }
  | { readonly ok: false; readonly code: TerrainRefusalCode };

/**
 * Raw (already JSON-decoded) source → the CANONICAL source + the snapshot it would publish, or the named refusal.
 * A shape the contract rejects is `TERRAIN_SOURCE_MALFORMED`; a surface the builder rejects keeps its own name
 * (`TERRAIN_INSUFFICIENT_SURFACE` · `TERRAIN_EMPTY_AFTER_CLIP` · `TERRAIN_TOO_DENSE`).
 */
export function judgeListingTerrainSource(raw: unknown): ListingTerrainVerdict {
  const source = parseListingTerrainSource(raw);
  if (source === null) return { ok: false, code: 'TERRAIN_SOURCE_MALFORMED' };

  const built = buildListingTerrainSnapshot(toListingTerrainInput(source));
  if (!built.ok) return { ok: false, code: refusalOfTerrainRejection(built.reason) };
  return { ok: true, source, snapshot: built.snapshot };
}
