/**
 * ADR-534 Φ2 — **Per-bay πάχος πλάκας οροφής** (EC2 §7.4.2, έλεγχος βέλους l/d).
 *
 * Pure γέφυρα: άνοιγμα φατνώματος (mm) → πάχος (mm) μέσω του structural SSoT
 * `suggestSupportedSlabThickness` (slab-sizing). Η πάνω όψη μένει ομοεπίπεδη (μονολιθικό
 * πέλμα)· διαφορετικό πάχος ανά φάτνωμα → το soffit κάνει σκαλοπάτι στη γραμμή του δοκαριού.
 *
 * Δομικό σύστημα → συντελεστής K (EC2 Table 7.4N): **εσωτερικό** φάτνωμα (πάκτωση σε δοκάρια
 * παντού) → `continuous` (K=1.5)· **ακραίο/περιμετρικό** → `simple` (K=1.0, conservative).
 * Two-way → άνοιγμα = η **μικρότερη** διάσταση (ο sizer ζητά ένα ελεύθερο άνοιγμα· conservative).
 *
 * Χωρίς φορτίο σχεδιασμού → η ULS πύλη δίνει 0 → **κυριαρχεί το l/d** = ακριβώς EC2 §7.4.2.
 *
 * @see ../structural/sizing/slab-sizing.ts — `suggestSupportedSlabThickness` (το pure core)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md §Φ2
 */

import type { StructuralCodeProvider } from '../structural/codes/structural-code-types';
import { suggestSupportedSlabThickness } from '../structural/sizing/slab-sizing';

/** Είσοδος per-bay διαστασιολόγησης: ελεύθερο άνοιγμα + αν το φάτνωμα είναι εσωτερικό. */
export interface CeilingBayThicknessInput {
  /** Ελεύθερο άνοιγμα σχεδιασμού (mm) — two-way → η μικρότερη διάσταση του φατνώματος. */
  readonly spanMm: number;
  /** `true` αν το φάτνωμα πακτώνεται σε δοκάρια σε όλες τις πλευρές (εσωτερικό → K=1.5). */
  readonly interior: boolean;
}

/**
 * Προτεινόμενο πάχος (mm) ενός φατνώματος οροφής, ή `undefined` όταν δεν εφαρμόζεται
 * (μηδενικό/μη-έγκυρο άνοιγμα) ⇒ ο caller κρατά το default πάχος του override.
 */
export function suggestCeilingBayThickness(
  provider: StructuralCodeProvider,
  input: CeilingBayThicknessInput,
): number | undefined {
  if (!(input.spanMm > 0)) return undefined;
  const sizing = suggestSupportedSlabThickness(provider, {
    // Required fields που δεν διαβάζει το thickness-path — placeholders (geometry-is-SSoT αλλού).
    widthMm: input.spanMm,
    lengthMm: input.spanMm,
    thicknessMm: 0,
    grossAreaMm2: input.spanMm * input.spanMm,
    kind: 'suspended',
    maxFreeSpanMm: input.spanMm,
    supportType: input.interior ? 'continuous' : 'simple',
  });
  return sizing?.thicknessMm;
}
