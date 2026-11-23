/**
 * @fileoverview **The CONFIRMED plot outline — what the server found in the drawing and the human confirmed** (ADR-920 §14.11 Ζ3).
 * @related ./plot-outline-types (the candidate) · ../publication/listing-terrain-source (`withPlotOutline`, the ONE writer of
 *   the outline into the terrain source) · server/listing-terrain/plot-outline-confirmation.server (the door's leg)
 * @module lib/terrain/plot-outline/plot-outline-confirmation
 *
 * 🔑 **Where it lives**: on the dossier record of the surveyor's drawing (`files_personal`), field `plotOutline` — a field the
 *    client can never write (`firestore.rules` → `measuredKeys()`), like every other fact the server measured on the bytes.
 *    So «confirmed» means: a candidate the SERVER found in THESE bytes (sha256), and that the human chose. A ring a browser
 *    sends is a claim; this is evidence. Not in Storage custom metadata: a ring with tessellated arcs outgrows its 8 KiB.
 * 🔑 **Provenance** (beyond Revit, whose property line forgets the CAD line it was picked from): the record keeps WHERE the
 *    outline was found — DXF layer/handle or PDF page — and the candidate id, the unit, and the digest of the drawing.
 * 🔑 Firestore has no arrays of arrays ⇒ the ring is stored as `{ x, y }` maps, WORLD mm as the Ζ1 core produced them. The
 *    canonical millimetre is applied ONCE, by `withPlotOutline`, when the outline enters a terrain source.
 *
 * Pure: no I/O, importable by the browser.
 */

import { z } from 'zod';

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { LISTING_TERRAIN_SOURCE_MAX_ABS_MM, LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES } from '../publication/listing-terrain-config';
import type { PlotOutlineChoice } from '../publication/listing-terrain-source';
import { isTopoUnit, type TopoUnit } from '../survey-import/topo-import-types';
import type { PlotOutlineCandidate, PlotOutlineOrigin } from './plot-outline-types';

/** History: 1 = Ζ3. */
export const CONFIRMED_PLOT_OUTLINE_VERSION = 1 as const;

/** Candidate ids are short (`dxf:<handle>` · `dxf#<n>` · `pdf:<page>:<n>`); past this it is not one of ours. */
const MAX_CANDIDATE_ID_LENGTH = 200;

/** What the browser sends to confirm (Π4 + Π9): WHICH candidate, never its ring. */
export interface PlotOutlineConfirmationRequest {
  readonly candidateId: string;
  readonly showInListing: boolean;
}

/** The confirmed outline, as stored on the drawing's record. */
export interface ConfirmedPlotOutline {
  readonly version: typeof CONFIRMED_PLOT_OUTLINE_VERSION;
  /** Implicitly closed, arcs tessellated — WORLD mm, exactly as the server's reading produced it. */
  readonly ring: readonly PlanarPoint[];
  /** Π9 — the owner's public choice. */
  readonly showInListing: boolean;
  /** Plan area of the ring, m² (the candidate's own measure). */
  readonly areaM2: number;
  readonly candidateId: string;
  readonly origin: PlotOutlineOrigin;
  /** The unit the human confirmed for a DXF without `$INSUNITS`; `null` when the file said it (or for a PDF). */
  readonly drawingUnit: TopoUnit | null;
  /** sha256 (hex) of the drawing's bytes — the outline belongs to THIS drawing, not to a file with the same name. */
  readonly drawingSha256: string;
}

const requestSchema = z.object({
  candidateId: z.string().trim().min(1).max(MAX_CANDIDATE_ID_LENGTH),
  showInListing: z.boolean(),
});

const coordinate = z.number().finite().min(-LISTING_TERRAIN_SOURCE_MAX_ABS_MM).max(LISTING_TERRAIN_SOURCE_MAX_ABS_MM);

/** Where a confirmed outline was found — the ONE schema (the record, and the status the door reports, Ζ4). */
export const plotOutlineOriginSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('dxf'),
    handle: z.string().nullable(),
    layer: z.string(),
    closure: z.enum(['flag', 'coincident-ends']),
  }),
  z.object({ source: z.literal('pdf-table'), page: z.number().int().positive() }),
]);

/** The confirmed facts of a drawing that are NOT its ring — shared with the status the door reports (Ζ4). */
export const confirmedDrawingFactsShape = {
  areaM2: z.number().finite().positive(),
  candidateId: z.string().min(1).max(MAX_CANDIDATE_ID_LENGTH),
  origin: plotOutlineOriginSchema,
  drawingUnit: z.custom<TopoUnit>(isTopoUnit).nullable(),
  drawingSha256: z.string().regex(/^[0-9a-f]{64}$/),
} as const;

const confirmedSchema = z.object({
  version: z.literal(CONFIRMED_PLOT_OUTLINE_VERSION),
  ring: z.array(z.object({ x: coordinate, y: coordinate })).min(3).max(LISTING_TERRAIN_SOURCE_MAX_RING_VERTICES),
  showInListing: z.boolean(),
  ...confirmedDrawingFactsShape,
});

/** The browser's JSON (a multipart string field) → the request, or `null` for anything that is not exactly one. */
export function parsePlotOutlineConfirmationRequest(raw: unknown): PlotOutlineConfirmationRequest | null {
  if (typeof raw !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = requestSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * ADR-920 §14.11 Ζ3c — **changing the outline WITHOUT a new drawing** (`PATCH`): the Π9 public choice, or an explicit removal.
 * Never a ring: the outline is the one the dossier already holds (Revit: a property line is edited or deleted as an object;
 * nobody re-imports the DWG to hide it).
 */
export type PlotOutlineAmendment =
  | { readonly kind: 'visibility'; readonly showInListing: boolean }
  | { readonly kind: 'remove' };

const amendmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('visibility'), showInListing: z.boolean() }).strict(),
  z.object({ kind: z.literal('remove') }).strict(),
]);

/** The browser's JSON body → the amendment, or `null` for anything that is not exactly one (unknown keys included). */
export function parsePlotOutlineAmendment(raw: unknown): PlotOutlineAmendment | null {
  const parsed = amendmentSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The outline after the amendment — `null` = none. Pure; the door decides whether there was one to amend.
 * Removing nothing gives nothing (idempotent); a visibility change needs an outline, so it is never applied to `null`.
 */
export function amendedPlotOutline(current: PlotOutlineChoice, amendment: PlotOutlineAmendment): PlotOutlineChoice | null {
  return amendment.kind === 'remove' ? null : { ringWorldMm: current.ringWorldMm, showInListing: amendment.showInListing };
}

/** The facts the door adds to the human's choice — measured on the bytes it received, never sent by the browser. */
export interface DrawingFacts {
  readonly drawingSha256: string;
  readonly drawingUnit: TopoUnit | null;
}

/** The server's own candidate + the human's choice → what the drawing's record keeps. */
export function confirmedPlotOutlineOf(
  candidate: PlotOutlineCandidate,
  request: PlotOutlineConfirmationRequest,
  facts: DrawingFacts,
): ConfirmedPlotOutline {
  return {
    version: CONFIRMED_PLOT_OUTLINE_VERSION,
    ring: candidate.ringWorldMm.map(({ x, y }) => ({ x, y })),
    showInListing: request.showInListing,
    areaM2: candidate.areaM2,
    candidateId: candidate.id,
    origin: candidate.origin,
    drawingUnit: facts.drawingUnit,
    drawingSha256: facts.drawingSha256,
  };
}

/** A stored field → the confirmed outline, or `null` when it is absent or not one this version wrote. */
export function readConfirmedPlotOutline(raw: unknown): ConfirmedPlotOutline | null {
  const parsed = confirmedSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The confirmed outline as `withPlotOutline` takes it — the ONE road into a terrain source. */
export function plotOutlineChoiceOf(confirmed: ConfirmedPlotOutline): PlotOutlineChoice {
  return { ringWorldMm: confirmed.ring, showInListing: confirmed.showInListing };
}
