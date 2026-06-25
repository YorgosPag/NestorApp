/**
 * ADR-441 — Shared linear justification offset για «Εσχάρα από κάναβο» (beam/wall).
 *
 * Δοκάρια & τοίχοι αποθηκεύουν τον άξονά τους ως `start`/`end` (centerline) χωρίς
 * justification param. Για να εδραστούν με `inner`/`outer` (μία παρειά πάνω στον άξονα,
 * όπως οι πεδιλοδοκοί), μετατοπίζουμε **κάθετα** τα start/end κατά ±width/2 ΚΑΙ γράφουμε το
 * ίδιο offset ως σταθερό `extend` (mm) στα **perpendicular** bindings. Έτσι το follow-on-move
 * το διατηρεί δωρεάν: ο `deriveLineSlots` υπολογίζει `coord = axisOffset + extend·scale` →
 * η μετατοπισμένη παρειά μένει κλειδωμένη στον άξονα όταν αυτός κουνηθεί (ΙΔΙΟΣ μηχανισμός
 * με τον Finish-Face τοίχο, `resolveAxisBindings → axisValue`). Μηδέν αλλαγή geometry/type.
 *
 * Η math είναι **πανομοιότυπη** με το `stripJustifiedAxis` (foundation-geometry): κάθετο
 * offset = `canonicalAxisNormal × JUSTIFICATION_NORMAL_SIGN × hw`. Για axis-aligned grid
 * segments το offset είναι καθαρά κατά X (κατακόρυφο) ή Y (οριζόντιο)· ο per-axis διαχωρισμός
 * το χειρίζεται γενικά (και διαγώνια, θεωρητικά) και **προσθέτει** στο υπάρχον `extend`
 * (longitudinal column-trim extend = διαφορετικά slots → μηδέν σύγκρουση).
 *
 * @see ./axis-normal.ts — canonicalAxisNormal (shared)
 * @see ../geometry/foundation-geometry.ts — stripJustifiedAxis (ίδια math, param-driven path)
 * @see ../hosting/derive-slots.ts — deriveLineSlots (follow-move consumer του extend)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GuideBinding, GuideBindingSlot } from '../hosting/guide-binding-types';
import {
  JUSTIFICATION_NORMAL_SIGN,
  type StripJustification,
} from '../types/foundation-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { canonicalAxisNormal } from './axis-normal';
import { justifyAxisPoints } from './axis-justify';

/** Κάτω από αυτό το |extend| (mm) → καμία μετατόπιση (coordinate ΠΑΝΩ στον άξονα). */
const EXTEND_EPS_MM = 0.01;

export interface JustifiedSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly bindings: readonly GuideBinding[];
}

/** Πρόσθεσε `deltaMm` στο `extend` ενός binding· καθάρισε το πεδίο αν μηδενιστεί. */
function addExtend(binding: GuideBinding, deltaMm: number): GuideBinding {
  if (Math.abs(deltaMm) < EXTEND_EPS_MM) return binding;
  const next = (binding.extend ?? 0) + deltaMm;
  if (Math.abs(next) < EXTEND_EPS_MM) {
    const { extend: _drop, ...rest } = binding;
    return rest;
  }
  return { ...binding, extend: next };
}

/** Το slot ανήκει στον X-άξονα (start-x/end-x) ή στον Y (start-y/end-y); */
function slotIsX(slot: GuideBindingSlot): boolean {
  return slot === 'start-x' || slot === 'end-x';
}
function slotIsY(slot: GuideBindingSlot): boolean {
  return slot === 'start-y' || slot === 'end-y';
}

/**
 * Εφάρμοσε grid justification σε ΕΝΑ γραμμικό segment (δοκάρι/τοίχος): μετατόπισε κάθετα
 * τα start/end κατά ±width/2 και κλείδωσε το offset στα perpendicular bindings (extend mm).
 * `center` → identity (no-op). Degenerate (μηδενικού μήκους) άξονας → identity.
 *
 * @param widthMm Πλάτος διατομής (mm) κάθετα στον άξονα.
 */
export function justifyGridSegment(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  widthMm: number,
  justification: StripJustification,
  sceneUnits: SceneUnits,
): JustifiedSegment {
  const sign = JUSTIFICATION_NORMAL_SIGN[justification];
  const n = canonicalAxisNormal(start, end);
  if (sign === 0 || !n) {
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y }, bindings };
  }
  // SSoT point-shift delegate (ADR-441/529) — η canonical-normal × sign × hw μετατόπιση των
  // start/end ζει πλέον ΜΟΝΟ στο `axis-justify.ts`. Εδώ μένει ΜΟΝΟ το binding-extend (binding-specific).
  const moved = justifyAxisPoints(start, end, widthMm, justification, sceneUnits);
  const s = mmToSceneUnits(sceneUnits);
  const jScene = sign * ((widthMm * s) / 2); // signed offset κατά μήκος του canonical normal (scene units)
  // Per-axis offset σε mm (extend μονάδα): scene offset / scale.
  const extendXmm = (n.nx * jScene) / s;
  const extendYmm = (n.ny * jScene) / s;
  return {
    start: moved.start,
    end: moved.end,
    bindings: bindings.map((b) =>
      slotIsX(b.slot) ? addExtend(b, extendXmm) : slotIsY(b.slot) ? addExtend(b, extendYmm) : b,
    ),
  };
}
