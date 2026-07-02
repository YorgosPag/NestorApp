/**
 * ADR-363 §5.6c — Γενικός edit-time φύλακας «σχέσεων» διατομής για ΟΛΟΥΣ τους τύπους κολόνας.
 *
 * Επεκτείνει τα §5.6 (ορθογώνια→τοιχίο, aspect>4) + §5.6b (ασυνήθιστο πάχος/μήκος τοιχίου) σε κάθε
 * τύπο (Γ/Τ/Π/Ι/πολύγωνο/σύνθετη/τοιχίο-min-πάχος): όταν η αλλαγή διαστάσεων βγάζει τη διατομή εκτός
 * λογικού/κανονιστικού εύρους (γεωμετρική εκφύλιση, λυγηρότητα, ή — προαιρετικά — ποσοστό οπλισμού).
 *
 * **ΜΗΔΕΝ διπλότυπο κανόνα:** οι «σχέσεις» κάθε τύπου ζουν ΗΔΗ στον validator· εδώ απλώς κάνουμε
 * `collectColumnViolationKeys` σε prev & next και επιστρέφουμε **μόνο τις ΝΕΕΣ** (crossing-only,
 * ίδιο μοτίβο με `detectRectColumnBecomesWall` / `detectShearWallExtentCrossing`) → μηδέν re-nag.
 *
 * **Κόστος (ADR-040):** `includeReinforcement:false` (default) = φθηνό (γεωμετρία+λυγηρότητα) → ασφαλές
 * για το live-ghost 60fps hot-path. `includeReinforcement:true` = πλήρες (incl. ρ, βαρύς suggester) →
 * ΜΟΝΟ στο dialog-on-release (μία κλήση ανά edit).
 *
 * @see ../validators/column-validator.ts — `collectColumnViolationKeys` (η ΜΙΑ πηγή των σχέσεων)
 * @see ./column-aspect.ts — αδελφός §5.6 · ./shear-wall-extents.ts — αδελφός §5.6b
 * @see ./section-relationship-confirm-store.ts — edit-time confirm store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6c
 */

import type { ColumnParams } from '../types/column-types';
import type { StructuralCodeId } from '../structural/codes';
import { collectColumnViolationKeys } from '../validators/column-validator';

/** Οι νέες παραβιάσεις «σχέσεων» που εμφανίστηκαν με την τρέχουσα αλλαγή (i18n keys, ήδη μεταφρασμένα). */
export interface SectionRelationshipWarning {
  readonly violationKeys: readonly string[];
}

export interface SectionRelationshipDetectOpts {
  /** true → περιλαμβάνει τον (βαρύ) έλεγχο ποσοστού οπλισμού. false/undefined → φθηνό (hot-path safe). */
  readonly includeReinforcement?: boolean;
  /** Ενεργός κανονισμός για τα όρια ρ (μόνο όταν includeReinforcement=true). */
  readonly codeId?: StructuralCodeId;
}

/**
 * Edit-time detector: επιστρέφει non-null ΜΟΝΟ όταν η μετάβαση `prev → next` **εισάγει** νέα/-ες
 * παραβίαση/-εις «σχέσης» διατομής (παρόν στο next, απόν στο prev). Επιστρέφει `null` όταν δεν υπάρχει
 * καμία ΝΕΑ παραβίαση — ήδη-υπάρχουσες παραβιάσεις ΔΕΝ ξαναειδοποιούν (guard μόνο στη μετάβαση).
 */
export function detectColumnRelationshipWarning(
  prev: ColumnParams,
  next: ColumnParams,
  opts?: SectionRelationshipDetectOpts,
): SectionRelationshipWarning | null {
  const prevKeys = new Set(collectColumnViolationKeys(prev, opts));
  const fresh = collectColumnViolationKeys(next, opts).filter((k) => !prevKeys.has(k));
  if (fresh.length === 0) return null;
  return { violationKeys: [...new Set(fresh)] };
}
