/**
 * ADR-920 Β3 — the wire contract of «Publish terrain to the listing»: what the door AND every client
 * (owner form Β4, DXF Viewer Β5) must agree on. Sibling of `floorplan-publication-contract` (ADR-909).
 *
 * | what | written by | read by |
 * |---|---|---|
 * | the multipart fields | the client | the door |
 * | content type + byte ceiling | — | both (the client refuses before uploading 8 MB) |
 * | the refusal codes | the door | the UI, which owes a human message for EACH one |
 *
 * 🔑 **Closed list of codes.** A code born in the door without a row here would reach the screen as
 * «something went wrong»; the anchor `terrain-publication-contract.test` reads the door's SOURCE and
 * catches it.
 *
 * Pure: no I/O, importable by the browser.
 *
 * @module lib/terrain/publication/terrain-publication-contract
 */

import type { ListingTerrainRejection } from './listing-terrain-types';

/** Multipart field names. The browser sends nothing else. */
export const TERRAIN_UPLOAD_FIELDS = {
  /** The canonical survey source (`ListingTerrainSource`) as an `application/json` blob. */
  source: 'source',
  /** The Δ2 declaration (`TerrainSurveyDeclaration`) as a JSON string. */
  declaration: 'declaration',
  /** Optional: JSON array of the scene file ids the survey came from (DXF Viewer door) — provenance only. */
  sceneFileIds: 'sceneFileIds',
} as const;

/** The only content type the door accepts for the source. */
export const TERRAIN_SOURCE_CONTENT_TYPE = 'application/json';

/** Every reason the door refuses — by name, never «something went wrong». */
export const TERRAIN_REFUSAL_CODES = [
  // The request body.
  'TERRAIN_SOURCE_REQUIRED',
  'TERRAIN_TYPE_UNSUPPORTED',
  'TERRAIN_SOURCE_EMPTY',
  'TERRAIN_SOURCE_TOO_LARGE',
  'TERRAIN_SOURCE_MALFORMED',
  // The Δ2 declaration.
  'TERRAIN_DECLARATION_INVALID',
  'TERRAIN_SURVEY_DATE_IN_FUTURE',
  // The property and the survey itself.
  'TERRAIN_NOT_LAND',
  'TERRAIN_INSUFFICIENT_SURFACE',
  'TERRAIN_EMPTY_AFTER_CLIP',
  'TERRAIN_TOO_DENSE',
  // The publication.
  'TERRAIN_PUBLICATION_NOT_CAPABLE',
  'TERRAIN_UPLOAD_FAILED',
] as const;

export type TerrainRefusalCode = (typeof TERRAIN_REFUSAL_CODES)[number];

const REFUSAL_CODES: ReadonlySet<string> = new Set(TERRAIN_REFUSAL_CODES);

/** Is what the server sent one of OUR refusal codes? */
export function isTerrainRefusalCode(value: unknown): value is TerrainRefusalCode {
  return typeof value === 'string' && REFUSAL_CODES.has(value);
}

/**
 * The builder's named rejection → the door's refusal code. Exhaustive: a new rejection in
 * `ListingTerrainRejection` breaks compilation here until it gets a code (and a human message).
 */
export function refusalOfTerrainRejection(reason: ListingTerrainRejection): TerrainRefusalCode {
  switch (reason) {
    case 'insufficient-surface':
      return 'TERRAIN_INSUFFICIENT_SURFACE';
    case 'empty-after-clip':
      return 'TERRAIN_EMPTY_AFTER_CLIP';
    case 'too-dense':
      return 'TERRAIN_TOO_DENSE';
  }
}
