/**
 * ADR-929 Φ4 · Δ9 — **βεβαιότητα με τις συνιστώσες της**: γεωμετρία (όραση) · ανάγνωση (VLM) · λύτης (συνόρθωση).
 *
 * 🔑 **Γεωμετρικός μέσος, όχι αριθμητικός.** Μια πρόταση είναι τόσο σίγουρη όσο η **πιο αδύναμη** μηχανή της, μαλακά: ένας
 * παράγοντας 0,1 δεν «σώζεται» από δύο παράγοντες 1 (αριθμητικός μέσος: 0,7 — παραπλανητικό), ενώ ο γεωμετρικός δίνει 0,46.
 * 🔑 **«Δεν ελέγχθηκε» ≠ «σωστό».** Μια διάσταση που καμία άλλη μέτρηση δεν ελέγχει (αριθμός πλεονασμού ~0) παίρνει
 * παράγοντα λύτη 0,5, όσο τέλεια κι αν «κάθεται»: η εφαρμογή δεν ισχυρίζεται κάτι που δεν μπορεί να ξέρει.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/fusion-confidence
 */

import { clamp01 } from '@/lib/geometry/scalar';
import type { ObservationVerdict } from '@/lib/linear-algebra/robust-adjustment';
import type { PlanConfidence, PlanConfidenceFactor } from '../plan-recognition-types';
import type { DimensionBinding } from './plan-fusion-types';

/** Παράγοντας λύτη για παρατήρηση που **δεν** ελέγχεται (καμία άλλη μέτρηση δεν τη διασταυρώνει). */
export const UNCHECKED_SOLVER_FACTOR = 0.5;
/** Παράγοντας λύτη για παρατήρηση που ο λύτης **απέρριψε** ως χονδροειδές σφάλμα. */
export const REJECTED_SOLVER_FACTOR = 0.1;
/** Πάνω από αυτόν τον αριθμό πλεονασμού μια παρατήρηση θεωρείται **πλήρως** ελεγμένη. */
const WELL_CONTROLLED_REDUNDANCY = 0.5;

const BINDING_CLEAR = 0.9;
const BINDING_AMBIGUOUS = 0.5;

export function composeConfidence(factors: Readonly<Partial<Record<PlanConfidenceFactor, number>>>): PlanConfidence {
  const clean: Partial<Record<PlanConfidenceFactor, number>> = {};
  for (const [key, value] of Object.entries(factors) as [PlanConfidenceFactor, number | undefined][]) {
    if (value !== undefined && Number.isFinite(value)) clean[key] = clamp01(value);
  }
  const values = Object.values(clean) as number[];
  const score = values.length === 0 ? 0 : Math.exp(values.reduce((s, v) => s + Math.log(Math.max(v, 1e-6)), 0) / values.length);
  return { score, factors: clean };
}

/**
 * Ο παράγοντας του λύτη από την ετυμηγορία μιας παρατήρησης. `checked = false` ⇒ ο καλών έκρινε ότι η παρατήρηση **δεν**
 * ελέγχεται επαρκώς (π.χ. το ελάχιστο ανιχνεύσιμο σφάλμα μιας διάστασης είναι μεγάλο), ακόμη κι αν έχει `w`.
 */
export function solverFactor(verdict: ObservationVerdict, critical: number, checked = true): number {
  if (!verdict.active) return REJECTED_SOLVER_FACTOR;
  if (!checked || verdict.w === null || verdict.redundancy === null) return UNCHECKED_SOLVER_FACTOR;
  const controlled = Math.min(1, verdict.redundancy / WELL_CONTROLLED_REDUNDANCY);
  const fit = 1 - Math.min(1, Math.abs(verdict.w) / critical);
  return UNCHECKED_SOLVER_FACTOR + (1 - UNCHECKED_SOLVER_FACTOR) * controlled * fit;
}

/** Ο παράγοντας γεωμετρίας μιας δέσης: σαφής ή διφορούμενη. */
export const bindingFactor = (binding: DimensionBinding | null): number =>
  binding === null ? 0 : binding.ambiguous ? BINDING_AMBIGUOUS : BINDING_CLEAR;
