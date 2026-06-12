/**
 * ADR-441 Slice 6+9 — Reconciling «Εσχάρα από κάναβο» (binding-aware managed diff).
 *
 * Pure diff ανάμεσα στο **target** (πλήρης σωστή εσχάρα για τον τρέχοντα κάναβο,
 * `buildStripGridFromGuides`) και τις **existing** grid-managed λωρίδες στη σκηνή.
 * Επιστρέφει το minimal delta ώστε ο orchestrator να το εκτελέσει ως ΕΝΑ atomic
 * reconcile (Revit/Tekla managed regeneration), χωρίς διπλούς και χωρίς stale
 * corner-fill, διατηρώντας **id + instance overrides** στις λωρίδες που επιβιώνουν.
 *
 * **ADR-441 Slice 9 — ταυτότητα = `segmentKey` (coordinate-free), ΟΧΙ full signature.**
 * Το `segmentKeyFromBindings` ταυτοποιεί το grid-segment ΑΠΟΚΛΕΙΣΤΙΚΑ από τους
 * οριοθέτες άξονες (guide-ids) → σταθερό όταν ένας άξονας **μετακινείται** (Revit
 * datum-move). Έτσι:
 *  - target segmentKey ∉ existing → **create** (νέο φάτνωμα, ή ζεύγος αξόνων που
 *    εμφανίστηκε — π.χ. προστέθηκε/πέρασε άξονας, split).
 *  - existing segmentKey ∉ target → **delete** (φάτνωμα που έπαψε — διαγραφή άξονα,
 *    ή crossing που άλλαξε το ζεύγος γειτονικών αξόνων· split-obsolete whole).
 *  - segmentKey **και στα δύο** → **managed update in-place** (κρατά id):
 *    - coords ← target (η λωρίδα ακολουθεί τον άξονα που κουνήθηκε),
 *    - διατομή (width/thickness/elevation) ← existing (instance value),
 *    - έδραση: **χειροκίνητη** (`justificationManual`) → preserve override (Revit
 *      instance param)· **auto** → ευθυγράμμιση στον κανόνα (target, 5a-grid self-heal).
 *    - emit μόνο αν κάτι άλλαξε (coords ή έδραση)· αλλιώς `unchanged`.
 *  - δύο existing ίδιο segmentKey (legacy διπλό) → ο πρώτος = canonical match, οι
 *    υπόλοιποι → `toDelete` (dedup καθαρισμός).
 *
 * Το «άλλαξαν τα coords;» ελέγχεται μέσω του `gridStripSignature` (extend-invariant,
 * tol-rounded) — ίδιο segmentKey + ίδιο signature ⇒ ίδια γεωμετρία.
 *
 * Μη grid-managed λωρίδες (`segmentKey === null`: legacy ορφανές χωρίς bindings,
 * χειροκίνητες χωρίς grid) **ΠΟΤΕ** δεν μπαίνουν στο `toDelete`/`toUpdate`.
 *
 * @see ./foundation-grid-segments.ts — segmentKeyFromBindings (identity) + gridStripSignature (change-detect)
 * @see ./foundation-grid-rehost.ts — RehostedStrip (in-place update shape) + adoptTarget πρότυπο
 * @see ./foundation-from-grid.ts — target builder (κανόνας justification)
 * @see ./foundation-grid-justification.ts — gridStripJustification (ο κανόνας, SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import {
  DEFAULT_STRIP_JUSTIFICATION,
  type FoundationEntity,
  type FoundationParams,
  type StripFootingParams,
  type StripJustification,
  type TieBeamParams,
} from '../types/foundation-types';
import { computeFoundationGeometry } from '../geometry/foundation-geometry';
import { gridStripSignature, segmentKeyFromBindings } from './foundation-grid-segments';
import type { RehostedStrip } from './foundation-grid-rehost';

export interface GridReconcileResult {
  /** target λωρίδες που λείπουν από τη σκηνή → δημιουργία. */
  readonly toCreate: readonly FoundationEntity[];
  /** existing grid-managed λωρίδες εκτός target (+ διπλά segmentKeys) → διαγραφή. */
  readonly toDelete: readonly FoundationEntity[];
  /**
   * Matched-by-segmentKey λωρίδες με αλλαγή coords ή έδρασης → in-place update
   * (κρατά id + instance overrides). Καλύπτει coordinate-follow (Slice 9) ΚΑΙ
   * auto re-justify (Slice 5a-grid) — και τα δύο = ίδιο `RehostFoundationsCommand`.
   */
  readonly toUpdate: readonly RehostedStrip[];
  /** Πλήθος λωρίδων πραγματικά αμετάβλητων (segmentKey match, μηδέν αλλαγή). */
  readonly unchanged: number;
}

type LineParams = StripFootingParams | TieBeamParams;

/** Map segmentKey → entity (πρώτος κερδίζει)· επιστρέφει και τα διπλά (extras). */
function segmentMap(
  strips: readonly FoundationEntity[],
): { readonly map: Map<string, FoundationEntity>; readonly dupes: FoundationEntity[] } {
  const map = new Map<string, FoundationEntity>();
  const dupes: FoundationEntity[] = [];
  for (const s of strips) {
    const key = segmentKeyFromBindings(s.guideBindings ?? []);
    if (key === null) continue;
    if (map.has(key)) dupes.push(s);
    else map.set(key, s);
  }
  return { map, dupes };
}

/** Ενεργή έδραση (default center) γραμμικών params. */
function effectiveJustification(p: FoundationParams): StripJustification {
  return (p.kind === 'pad' ? undefined : p.justification) ?? DEFAULT_STRIP_JUSTIFICATION;
}

/**
 * Επιθυμητά γραμμικά params για matched grid-segment: coords ← target (ακολουθούν τον
 * άξονα), διατομή ← existing (instance value)· έδραση = χειροκίνητη ? existing override :
 * κανόνας target. center → αφαιρεί το πεδίο (Firestore-clean).
 */
function buildManagedParams(existing: LineParams, target: LineParams): LineParams {
  const { justification: _ej, justificationManual: _em, ...rest } = existing;
  const base = { ...(rest as LineParams), start: target.start, end: target.end };
  if (existing.justificationManual === true) {
    // Revit instance override: κράτα έδραση + flag, ακολούθησε μόνο coords.
    return existing.justification === undefined
      ? { ...base, justificationManual: true }
      : { ...base, justification: existing.justification, justificationManual: true };
  }
  const rule = effectiveJustification(target);
  return rule === DEFAULT_STRIP_JUSTIFICATION ? base : { ...base, justification: rule };
}

/**
 * Αν το matched ζεύγος (existing ↔ target, ίδιο segmentKey) έχει αλλαγή coords ή
 * έδρασης → επιστρέφει το in-place update (ίδιο id, instance overrides preserved)·
 * αλλιώς null (αμετάβλητο).
 */
function computeManagedUpdate(
  existing: FoundationEntity,
  target: FoundationEntity,
): RehostedStrip | null {
  const p = existing.params;
  const tp = target.params;
  if (p.kind === 'pad' || tp.kind === 'pad') return null; // segmentKey ήδη null για pad
  const manual = p.justificationManual === true;
  const coordsChanged = gridStripSignature(existing) !== gridStripSignature(target);
  const justChanged = !manual && effectiveJustification(p) !== effectiveJustification(tp);
  if (!coordsChanged && !justChanged) return null;
  const nextParams = buildManagedParams(p, tp);
  return {
    original: existing,
    rehosted: {
      ...existing,
      params: nextParams,
      guideBindings: target.guideBindings,
      geometry: computeFoundationGeometry(nextParams),
    },
  };
}

/**
 * Υπολόγισε το reconcile delta. `existing` μπορεί να περιέχει non-grid λωρίδες —
 * φιλτράρονται εδώ (μόνο όσες έχουν segmentKey θεωρούνται grid-managed).
 */
export function reconcileGridStrips(
  target: readonly FoundationEntity[],
  existing: readonly FoundationEntity[],
): GridReconcileResult {
  const { map: targetByKey } = segmentMap(target);
  const { map: existingByKey, dupes } = segmentMap(existing);

  const toCreate: FoundationEntity[] = [];
  for (const [key, entity] of targetByKey) {
    if (!existingByKey.has(key)) toCreate.push(entity);
  }

  const toDelete: FoundationEntity[] = [...dupes];
  const toUpdate: RehostedStrip[] = [];
  let unchanged = 0;
  for (const [key, entity] of existingByKey) {
    const targetMatch = targetByKey.get(key);
    if (!targetMatch) {
      toDelete.push(entity);
      continue;
    }
    const update = computeManagedUpdate(entity, targetMatch);
    if (update) toUpdate.push(update);
    else unchanged += 1;
  }

  return { toCreate, toDelete, toUpdate, unchanged };
}
