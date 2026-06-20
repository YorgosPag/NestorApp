/**
 * Beam Axis Scene Frame — pure SSoT (N.0.2) για το **καρτεσιανό πλαίσιο του άξονα δοκαριού
 * σε scene units** (origin + μοναδιαίο διάνυσμα + μήκος).
 *
 * Πολλοί topology consumers (`maxClearSubSpanMm` ADR-504, `beamInteriorSupports` ADR-480/481,
 * `buildBeamMaxWidthMap` ADR-506) ξανα-έγραφαν inline το ΙΔΙΟ:
 *
 *     const s = beam.params.startPoint; const e = beam.params.endPoint;
 *     const dx = e.x - s.x; const dy = e.y - s.y;
 *     const len = Math.hypot(dx, dy);  if (len < 1e-6) bail
 *     const ux = dx / len; const uy = dy / len;
 *
 * ΕΝΑ SSoT εδώ — μηδέν διπλό geometry primitive. Όλοι προβάλλουν footprints κολωνών στον
 * άξονα μέσω `projectPolygonOnAxis`/`projectColumnFootprintOnAxis` με αυτό το frame ως βάση.
 *
 * **Params-only (geometry-independent):** εξαρτάται ΜΟΝΟ από `params.startPoint/endPoint`, ΟΧΙ
 * από το `geometry` cache — ο `beamInteriorSupports` δουλεύει καθαρά σε scene-fraction χωρίς να
 * χρειάζεται `geometry.length`. Όποιος consumer χρειάζεται scene→mm μετατροπή (π.χ.
 * `buildBeamMaxWidthMap`) την παράγει τοπικά: `geometry.length·1000 / lenScene`. Pure — zero
 * React/DOM/Firestore. Το straight άξονα αρκεί για projection (curved → `beam-axis-projection`).
 *
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis (ο consumer-primitive)
 * @see ../columns/column-face-trim.ts — projectColumnFootprintOnAxis (entity wrapper)
 */

import type { BeamEntity } from '../types/beam-types';

const DEGENERATE_EPS = 1e-6;

/** Καρτεσιανό πλαίσιο άξονα δοκαριού (scene units, params-only). */
export interface BeamAxisSceneFrame {
  /** Αρχή άξονα = `startPoint` (scene units). */
  readonly ax: number;
  readonly ay: number;
  /** Μοναδιαίο διάνυσμα διεύθυνσης (scene). */
  readonly ux: number;
  readonly uy: number;
  /** Μήκος άξονα σε scene units (`hypot(end−start)`). */
  readonly lenScene: number;
}

/**
 * Το πλαίσιο του άξονα ενός δοκαριού (origin + μοναδιαίο + lenScene). `null` για εκφυλισμένο
 * άξονα (μηδενικό μήκος) — ο caller κάνει bail χωρίς crash. Από `params.startPoint/endPoint` μόνο.
 */
export function beamAxisSceneFrame(beam: BeamEntity): BeamAxisSceneFrame | null {
  const s = beam.params.startPoint;
  const e = beam.params.endPoint;
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const lenScene = Math.hypot(dx, dy);
  if (lenScene < DEGENERATE_EPS) return null;
  return { ax: s.x, ay: s.y, ux: dx / lenScene, uy: dy / lenScene, lenScene };
}
