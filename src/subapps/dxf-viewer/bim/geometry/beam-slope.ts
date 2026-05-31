/**
 * Beam slope-plane SSoT (ADR-401 Phase E/(β) — κεκλιμένη δοκός).
 *
 * Καθιερώνει την **κανονική ερμηνεία** της κεκλιμένης δοκού: η πάνω παρειά
 * γέρνει **γραμμικά κατά μήκος του άξονα** της δοκού — `topElevation` στο
 * `startPoint`, `topElevationEnd` στο `endPoint` — με σταθερό βάθος (Revit
 * sloped beam). Επιστρέφει το απόλυτο Z (mm) της επάνω / κάτω παρειάς σε
 * οποιοδήποτε plan-point, προβάλλοντάς το στον άξονα start→end.
 *
 * Πρώτος καταναλωτής = ο `beamHostInput` (wall-host-plan-builder) ώστε ένας
 * τοίχος με `topBinding='attached'` σε κεκλιμένη δοκό να ακολουθεί την κεκλιμένη
 * κάτω-παρειά (z0mm ≠ z1mm στο `HostUndersidePlan`) — ΑΚΡΙΒΩΣ το ίδιο pattern με
 * την tilted slab (slab-slope.ts, Phase E2). Επιπλέον το 3D shear
 * (`applyBeamSlope`) + η 2D τομή (`beamSection`) διαβάζουν τον ίδιο SSoT.
 *
 * Σύμβαση:
 *   - Ο άξονας ορίζεται από `startPoint → endPoint` (chord — ισχύει και για
 *     `curved`, με προβολή στη χορδή).
 *   - `topElevation` = πάνω παρειά στο `startPoint` (nominal/pivot στάθμη).
 *   - `topElevationEnd` = πάνω παρειά στο `endPoint`. Απών / ίσο → offset 0
 *     (flat fast-path, byte-for-byte ίδιο με τον προηγούμενο scalar υπολογισμό).
 *
 * **Unit-safety:** το offset = `f · (topElevationEnd − topElevation)` όπου το
 * `f` είναι **αδιάστατο** axis fraction (προβολή/μήκος²). Άρα το magnitude (Δmm)
 * είναι σωστό ΑΝΕΞΑΡΤΗΤΑ από το αν το `startPoint`/`endPoint`/`pt` είναι σε mm ή
 * canvas units — σε αντίθεση με το slab slope (που χρησιμοποιεί canvas-unit
 * αποστάσεις × angle% και κληρονομεί το mmScaleFor latent issue, ADR-401 §E2).
 *
 * Μονάδες: το `pt` ΠΡΕΠΕΙ να είναι στο **ίδιο plan space** με τα
 * `startPoint`/`endPoint` (canvas units — όπως το `computeBeamGeometry().outline`).
 * Το αποτέλεσμα είναι απόλυτο mm (ίδια σύμβαση με `beam.topElevation`, ADR-369 §2.2).
 *
 * @see slab-slope.ts — το αδελφό SSoT για tilted slab/roof (Phase E2)
 * @see wall-host-plan-builder.ts — `beamHostInput` (πρώτος consumer)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.3, Phase E
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §2.2, §9 Q7
 */

import type { BeamParams } from '../types/beam-types';

/** Ελάχιστο 2D plan-point (ίδιο space με `BeamParams.startPoint`/`endPoint`). */
export interface BeamPlanPoint {
  readonly x: number;
  readonly y: number;
}

/** Αριθμητικό όριο για μη-εκφυλισμένο μήκος άξονα. */
const LEN_EPS = 1e-9;

/**
 * `true` όταν η δοκός είναι **κεκλιμένη** (έχει `topElevationEnd` που διαφέρει
 * από το `topElevation`). Κεντρικό predicate — οι consumers το χρησιμοποιούν για
 * να επιλέξουν flat fast-path vs sloped path.
 */
export function isBeamTilted(params: BeamParams): boolean {
  return params.topElevationEnd !== undefined && params.topElevationEnd !== params.topElevation;
}

/**
 * Slope offset (mm) στο `pt` σχετικά με το `startPoint` (όπου offset = 0): το
 * αδιάστατο axis fraction `f` (προβολή του `pt` στον άξονα start→end / μήκος²)
 * × `(topElevationEnd − topElevation)`. Flat (μη-tilted) ή εκφυλισμένος άξονας → 0.
 */
export function beamSlopeOffsetZmm(params: BeamParams, pt: BeamPlanPoint): number {
  if (!isBeamTilted(params)) return 0;
  const ax = params.startPoint.x;
  const ay = params.startPoint.y;
  const dx = params.endPoint.x - ax;
  const dy = params.endPoint.y - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < LEN_EPS) return 0;
  const f = ((pt.x - ax) * dx + (pt.y - ay) * dy) / len2; // αδιάστατο 0..1 στον άξονα
  return f * ((params.topElevationEnd as number) - params.topElevation);
}

/**
 * Απόλυτο Z (mm) της **επάνω** παρειάς της δοκού στο `pt`.
 * = `topElevation + zOffset + slopeOffset(pt)`. ADR-369 §2.2 (top-of-beam).
 */
export function beamTopZmmAt(params: BeamParams, pt: BeamPlanPoint): number {
  return params.topElevation + (params.zOffset ?? 0) + beamSlopeOffsetZmm(params, pt);
}

/**
 * Απόλυτο Z (mm) της **κάτω** παρειάς της δοκού στο `pt` (σταθερό βάθος → η
 * κάτω παρειά είναι παράλληλο κεκλιμένο επίπεδο). = `topZ(pt) − depth`.
 * Αυτό καταναλώνει ο `beamHostInput` για το `HostUndersidePlan.z*mm`.
 */
export function beamUndersideZmmAt(params: BeamParams, pt: BeamPlanPoint): number {
  return beamTopZmmAt(params, pt) - params.depth;
}
