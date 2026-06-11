/**
 * ADR-441 Slice 6 — Reconciling «Εσχάρα από κάναβο» (signature-set diff).
 *
 * Pure diff ανάμεσα στο **target** (πλήρης σωστή εσχάρα για τον τρέχοντα κάναβο,
 * `buildStripGridFromGuides`) και τις **existing** grid-managed λωρίδες στη σκηνή.
 * Επιστρέφει το minimal delta ώστε ο orchestrator να το εκτελέσει ως ΕΝΑ atomic
 * reconcile (Revit/Tekla managed regeneration), χωρίς διπλούς και χωρίς stale
 * corner-fill, διατηρώντας ids στις αμετάβλητες.
 *
 * Ταυτότητα = `gridStripSignature` (grid key + rounded geometry· **το justification ΔΕΝ
 * συμμετέχει** — δεν αλλάζει τα start/end):
 *  - target signature ∉ existing → **create** (νέο φάτνωμα ή αλλαγμένη γεωμετρία).
 *  - existing signature ∉ target → **delete** (split-obsolete whole).
 *  - signature και στα δύο → αμετάβλητη topology· **αν διαφέρει το justification**:
 *    - existing auto (`!justificationManual`) → **re-justify** στον κανόνα (target) →
 *      self-heal όταν ένας άξονας αλλάζει ρόλο περιμετρικός↔εσωτερικός (κρατά id).
 *    - existing **χειροκίνητο** (`justificationManual`) → preserve (Revit instance override).
 *
 * Μη grid-managed λωρίδες (`gridStripSignature === null`: legacy ορφανές χωρίς
 * bindings, χειροκίνητες χωρίς grid) **ΠΟΤΕ** δεν μπαίνουν στο `toDelete`/`toReJustify`.
 *
 * @see ./foundation-grid-segments.ts — gridStripSignature (identity)
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
import { gridStripSignature } from './foundation-grid-segments';

/** Re-justify ενός grid strip: ίδιο id/topology, νέα έδραση κανόνα + re-derived geometry. */
export interface ReJustifiedStrip {
  readonly original: FoundationEntity;
  readonly rejustified: FoundationEntity;
}

export interface GridReconcileResult {
  /** target λωρίδες που λείπουν από τη σκηνή → δημιουργία. */
  readonly toCreate: readonly FoundationEntity[];
  /** existing grid-managed λωρίδες εκτός target → διαγραφή. */
  readonly toDelete: readonly FoundationEntity[];
  /** Auto λωρίδες ίδιας topology με διαφορετική έδραση από τον κανόνα → reflow (κρατά id). */
  readonly toReJustify: readonly ReJustifiedStrip[];
  /** Πλήθος λωρίδων πραγματικά αμετάβλητων (signature & έδραση ίδια, ή χειροκίνητες). */
  readonly unchanged: number;
}

type LineParams = StripFootingParams | TieBeamParams;

/** Map signature → entity για grid-managed λωρίδες (αγνοεί null signatures). */
function signatureMap(
  strips: readonly FoundationEntity[],
): Map<string, FoundationEntity> {
  const map = new Map<string, FoundationEntity>();
  for (const s of strips) {
    const sig = gridStripSignature(s);
    if (sig !== null) map.set(sig, s);
  }
  return map;
}

/** Ενεργή έδραση (default center) γραμμικών params. */
function effectiveJustification(p: FoundationParams): StripJustification {
  return (p.kind === 'pad' ? undefined : p.justification) ?? DEFAULT_STRIP_JUSTIFICATION;
}

/** Νέα γραμμικά params με την έδραση του κανόνα (center → αφαιρεί το πεδίο, Firestore-clean). */
function applyJustification(p: LineParams, next: StripJustification): LineParams {
  const { justification: _j, justificationManual: _m, ...rest } = p;
  const base = rest as LineParams; // omit κρατά τον kind discriminator
  return next === DEFAULT_STRIP_JUSTIFICATION ? base : { ...base, justification: next };
}

/**
 * Αν το existing είναι auto (μη-χειροκίνητο) γραμμικό και η έδρασή του διαφέρει από
 * τον κανόνα (target) → επιστρέφει την re-justified εκδοχή του· αλλιώς null.
 */
function reJustifyIfNeeded(
  existing: FoundationEntity,
  target: FoundationEntity,
): ReJustifiedStrip | null {
  const p = existing.params;
  if (p.kind === 'pad') return null;
  if (p.justificationManual === true) return null; // χειροκίνητη υπεροχή → preserve
  const next = effectiveJustification(target.params);
  if (effectiveJustification(p) === next) return null; // ήδη σύμφωνη με τον κανόνα
  const nextParams = applyJustification(p, next);
  return {
    original: existing,
    rejustified: { ...existing, params: nextParams, geometry: computeFoundationGeometry(nextParams) },
  };
}

/**
 * Υπολόγισε το reconcile delta. `existing` μπορεί να περιέχει non-grid λωρίδες —
 * φιλτράρονται εδώ (μόνο όσες έχουν signature θεωρούνται grid-managed).
 */
export function reconcileGridStrips(
  target: readonly FoundationEntity[],
  existing: readonly FoundationEntity[],
): GridReconcileResult {
  const targetBySig = signatureMap(target);
  const existingBySig = signatureMap(existing);

  const toCreate: FoundationEntity[] = [];
  for (const [sig, entity] of targetBySig) {
    if (!existingBySig.has(sig)) toCreate.push(entity);
  }

  const toDelete: FoundationEntity[] = [];
  const toReJustify: ReJustifiedStrip[] = [];
  for (const [sig, entity] of existingBySig) {
    const targetMatch = targetBySig.get(sig);
    if (!targetMatch) {
      toDelete.push(entity);
      continue;
    }
    const reflow = reJustifyIfNeeded(entity, targetMatch);
    if (reflow) toReJustify.push(reflow);
  }

  const unchanged = targetBySig.size - toCreate.length - toReJustify.length;
  return { toCreate, toDelete, toReJustify, unchanged };
}
