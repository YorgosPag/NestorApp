/**
 * ADR-920 Β4.8 5γ — a REAL preview reply for the tests of the hook and the view: the real handler over a 3 × 3 surveyed
 * square (WORLD mm, ΕΓΣΑ'87 magnitudes), so nothing downstream is tested against a hand-made model.
 */

import type { TopoPoint } from '../../terrain-types';
import { createSurveyPreviewHost, type SurveyPreviewReply } from '../survey-preview-host';
import { packSurveyPoints } from '../survey-preview-points';

export const PREVIEW_SURFACE: readonly TopoPoint[] = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => (
  { x: 400_000_000 + i * 4_000, y: 4_200_000_000 + j * 4_000, z: 10_000 + i * 300 + j * 100 }
)));

/** A fresh handler per call ⇒ fresh objects (identity checks in the tests mean something). */
export function previewReplyOf(key: number, widthPx: number | null): SurveyPreviewReply {
  return createSurveyPreviewHost()({ key, points: packSurveyPoints(PREVIEW_SURFACE), widthPx });
}
