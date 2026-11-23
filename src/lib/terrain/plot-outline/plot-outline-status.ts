/**
 * @fileoverview **What the owner sees about the plot outline** — the answer of `GET …/terrain` (ADR-920 §14.11 Ζ4).
 * @related server/listing-terrain/dossier-terrain.reader (`loadDossierPlotOutlineStatus`, the ONE builder) ·
 *   ./plot-outline-confirmation (the confirmed outline on the drawing's record — the SAME facts schema) ·
 *   services/listings/plot-outline.client (the browser's reader)
 * @module lib/terrain/plot-outline/plot-outline-status
 *
 * 🔑 **The server decides, the browser shows.** Which decision holds (newest of drawing ⇄ relief, Ζ3c) is judged ONLY by the
 *    server's reader; the browser never re-derives it from `files_personal` (one rule, one place).
 * 🔑 **Honest provenance** (beyond Revit/Figma, whose derived objects forget — or hide — where they came from): the drawing is
 *    reported even when it is in the trash, and `isOutlineSource` says whether the outline that holds IS that drawing's ring.
 *    So the owner reads either «from drawing X, layer Y» or «from a drawing that is no longer in the dossier» — never a guess.
 * 🔑 **One schema, both sides**: the types are inferred from the schema the browser parses with — a shape the door did not
 *    send is `null`, never a cast.
 *
 * Pure: no I/O, importable by the browser.
 */

import { z } from 'zod';

import { confirmedDrawingFactsShape } from './plot-outline-confirmation';

const inForceSchema = z.object({
  showInListing: z.boolean(),
  /** Plan area of the ring, m². */
  areaM2: z.number().finite().positive(),
  /** Which record holds the decision that is in force (Ζ3c). */
  authority: z.enum(['drawing', 'relief']),
});

const drawingSchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string(),
  /** ISO instant, or `null` when the record carries none readable. */
  createdAt: z.string().nullable(),
  /** In the dossier, or in its trash (restorable — Figma's «Restore component»). */
  place: z.enum(['active', 'trash']),
  ...confirmedDrawingFactsShape,
  /** The outline in force IS this drawing's ring (canonical millimetre). */
  isOutlineSource: z.boolean(),
});

const statusSchema = z.object({
  /** A relief has been published (a `PATCH` needs one; without it the outline waits for the first contours, Π2). */
  hasRelief: z.boolean(),
  outline: inForceSchema.nullable(),
  drawing: drawingSchema.nullable(),
});

export type PlotOutlineInForce = z.infer<typeof inForceSchema>;
export type PlotOutlineAuthorityKind = PlotOutlineInForce['authority'];
export type PlotDrawingSummary = z.infer<typeof drawingSchema>;
export type PlotDrawingPlace = PlotDrawingSummary['place'];
export type PlotOutlineStatus = z.infer<typeof statusSchema>;

/** The door's JSON → the status, or `null` for anything that is not exactly one. */
export function parsePlotOutlineStatus(raw: unknown): PlotOutlineStatus | null {
  const parsed = statusSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
