/**
 * ADR-929 Δ21 (0) · Δ7 Γ — **είναι η κάτοψη σκίτσο;** Το ΕΝΑ σημείο απόφασης του είδους `sketch`. Καθαρή συνάρτηση.
 *
 * Σειρά αρχής (πρώτη που απαντά, νικά):
 *   1. **ο άνθρωπος** (διακόπτης στο πάνελ) — πάντα·
 *   2. **διανυσματική πηγή** ⇒ σχεδιασμένο σε CAD, άρα υπό κλίμακα (το ΤΕΣΤ1)·
 *   3. **οι γραμμένες διαστάσεις** — δύο υποθέσεις με την ΥΠΑΡΧΟΥΣΑ μηχανή συναίνεσης (`dimensionScaleConsensus`): με την
 *      ανοχή του **τυπωμένου** σχεδίου και με την ανοχή του **σκίτσου** (`cvSigmaMm`). Συμφωνούν μέσα στην πρώτη ⇒ υπό
 *      κλίμακα· μόνο μέσα στη δεύτερη ⇒ σκίτσο (DOC014: 2,05 × 4,12 m γραμμένα, ~1:1,65 στο χαρτί έναντι 1:2,01 ⇒ ~18 %).
 *   4. αλλιώς το είδος της εικόνας (`default`): καμία σιωπηλή εικασία.
 *
 * 🔑 **Διαφορετικές τιμές, όχι απλώς πολλές.** Δύο ίσες γραμμένες τιμές σε απέναντι πλευρές συμφωνούν σε ΚΑΘΕ κλίμακα (ίση
 *   τιμή, ίσο κενό στο χαρτί) ακόμη και σε σκίτσο· δεν αποδεικνύουν τίποτα για τις αναλογίες. Απόδειξη = ≥ 2 **διαφορετικές**
 *   τιμές (πέρα από την ακρίβεια γραφής τους) που συμφωνούν στην ίδια κλίμακα.
 * 🔑 Γιατί όχι ενδείξεις εικόνας (κυμάτωση πινελιάς, πάχος μελανιού): **μετρήθηκαν** σε 2 σκίτσα + 5 τυπωμένες σαρώσεις
 *   αδειών με τον πραγματικό εξαγωγέα τμημάτων και **δεν** ξεχωρίζουν (ADR-929 Δ7 Γ). Οι διαστάσεις απαντούν **απευθείας** στο
 *   ερώτημα που μας ενδιαφέρει: «έχει μέτρο το χαρτί;».
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/drawing-kind
 */

import type { PlanInputKind } from '../plan-recognition-types';
import type { DimensionTarget } from './dimension-binding';
import type {
  PlanDrawingKindDecision,
  PlanDrawingKindInput,
  PlanFusionOptions,
  PlanProportionsVerdict,
} from './plan-fusion-types';
import { agreeingTargets, dimensionScaleConsensus } from './scale-consensus';

/** Το λιγότερο που αποδεικνύει αναλογίες: δύο **διαφορετικές** γραμμένες τιμές στην ίδια κλίμακα. */
const MIN_DISTINCT_VALUES = 2;

const NO_DRAWING_INPUT: PlanDrawingKindInput = { choice: null, medium: 'raster' };

/** Πόσες διαφορετικές τιμές: δύο τιμές είναι «ίδιες» όταν απέχουν έως την ακρίβεια γραφής της πιο χοντρής. */
export function distinctWrittenValues(targets: readonly DimensionTarget[]): number {
  const sorted = [...targets].sort((a, b) => a.dimension.valueMm - b.dimension.valueMm);
  let count = 0;
  let last: DimensionTarget | null = null;
  for (const t of sorted) {
    const same = last !== null && t.dimension.valueMm - last.dimension.valueMm <= Math.max(t.precisionMm, last.precisionMm);
    if (!same) count += 1;
    last = t;
  }
  return count;
}

/** Συμφωνούν ≥ 2 διαφορετικές τιμές σε μία κλίμακα, μέσα στις ανοχές αυτών των στόχων; */
function proportionsProven(targets: readonly DimensionTarget[], o: PlanFusionOptions): boolean {
  const consensus = dimensionScaleConsensus(targets, o);
  return consensus !== null && distinctWrittenValues(agreeingTargets(targets, consensus.pxPerMm)) >= MIN_DISTINCT_VALUES;
}

/** Η κρίση των αναλογιών: ίδιες διαστάσεις, ανοχή τυπωμένου (`printed`) και ανοχή σκίτσου (`sketch`). */
export function proportionsVerdict(
  printed: readonly DimensionTarget[], sketch: readonly DimensionTarget[], o: PlanFusionOptions,
): PlanProportionsVerdict {
  if (proportionsProven(printed, o)) return 'to-scale';
  return proportionsProven(sketch, o) ? 'not-to-scale' : 'unproven';
}

export interface DrawingKindResolution {
  readonly decision: PlanDrawingKindDecision;
  /** Οι στόχοι διαστάσεων του είδους που κρίθηκε (ώστε η σύντηξη να μην τους ξαναχτίσει). */
  readonly targets: DimensionTarget[];
}

const SKETCH: PlanInputKind = 'sketch';

/**
 * Το είδος με το οποίο τρέχει η σύντηξη. `base` = το είδος της εικόνας (`inputKindOf`)· `targetsFor` χτίζει τους στόχους
 * διαστάσεων για ένα είδος (καλείται μόνο όσες φορές χρειάζεται).
 */
export function resolveDrawingKind(
  base: PlanInputKind,
  drawing: PlanDrawingKindInput | undefined,
  targetsFor: (kind: PlanInputKind) => DimensionTarget[],
  o: PlanFusionOptions,
): DrawingKindResolution {
  const { choice, medium } = drawing ?? NO_DRAWING_INPUT;
  const decided = (kind: PlanInputKind, basis: PlanDrawingKindDecision['basis'], proportions: PlanProportionsVerdict | null) =>
    ({ decision: { kind, basis, proportions }, targets: targetsFor(kind) });
  if (choice !== null) return decided(choice === 'sketch' ? SKETCH : base, 'human', null);
  if (medium === 'vector') return decided(base, 'vector-source', null);
  const printed = targetsFor(base);
  const sketch = targetsFor(SKETCH);
  const proportions = proportionsVerdict(printed, sketch, o);
  if (proportions === 'not-to-scale') return { decision: { kind: SKETCH, basis: 'dimensions', proportions }, targets: sketch };
  return { decision: { kind: base, basis: proportions === 'to-scale' ? 'dimensions' : 'default', proportions }, targets: printed };
}
