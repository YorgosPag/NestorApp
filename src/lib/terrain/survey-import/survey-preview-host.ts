/**
 * ADR-920 Β4.8 5γ — **the owner's terrain preview behind the RPC**: what runs inside the Web Worker (and, as the safety
 * net, on the main thread — the SAME code). Pure: no DOM, no React, no I/O.
 *
 *   packed points ─▶ prepareSurveyUpload ─▶ the door's own verdict (+ the body to send)
 *                                       └─▶ terrainMapModelOf(snapshot, marks, width class) ─▶ the map, ready to draw
 *
 * 🔑 **One survey kept in memory, by `key`** (the idea of Civil 3D surface snapshots: the next rebuild starts from stored
 *   data). The caller gives every distinct set of points a new key; a request with the SAME key reuses the triangulation
 *   and only re-draws the map — a resize of the screen never re-triangulates. Same key + same width ⇒ the same reply.
 * 🔑 **The preview IS the door's answer**: nothing here re-implements the verdict — `prepareSurveyUpload` is the function
 *   the server runs (`survey-upload-preparation.ts`).
 *
 * @module lib/terrain/survey-import/survey-preview-host
 */

import { terrainMapModelOf, type TerrainMapModel } from '../publication/terrain-map-model';
import { unpackSurveyPoints } from './survey-preview-points';
import { prepareSurveyUpload, type SurveyUploadPreparation } from './survey-upload-preparation';

export interface SurveyPreviewRequest {
  /** Identity of the point set, chosen by the caller: same key ⇔ same points. */
  readonly key: number;
  /** `packSurveyPoints` — transferred, not cloned. */
  readonly points: Float64Array;
  /** Width class of the on-screen map (`terrainMapWidthClassOf`); `null` = not measured yet. */
  readonly widthPx: number | null;
}

export interface SurveyPreviewReply {
  readonly key: number;
  readonly widthPx: number | null;
  readonly preparation: SurveyUploadPreparation;
  /** The map — `null` when the door refuses the points (there is no surface to draw). */
  readonly model: TerrainMapModel | null;
}

export type SurveyPreviewHandler = (request: SurveyPreviewRequest) => SurveyPreviewReply;

/** **The handler** — one per Worker (or per safety net), holding the last survey and its last map. */
export function createSurveyPreviewHost(): SurveyPreviewHandler {
  let survey: { readonly key: number; readonly preparation: SurveyUploadPreparation } | null = null;
  let last: SurveyPreviewReply | null = null;

  return (request) => {
    if (last !== null && last.key === request.key && last.widthPx === request.widthPx) return last;
    if (survey === null || survey.key !== request.key) {
      survey = { key: request.key, preparation: prepareSurveyUpload(unpackSurveyPoints(request.points)) };
    }
    const { preparation } = survey;
    const display = request.widthPx === null ? null : { widthPx: request.widthPx };
    const model = preparation.ok ? terrainMapModelOf(preparation.snapshot, preparation.marks, display) : null;
    last = { key: request.key, widthPx: request.widthPx, preparation, model };
    return last;
  };
}
