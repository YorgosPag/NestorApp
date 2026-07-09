/**
 * ADR-608 Φ-grouping — mapping ΤΩΝ ΔΙΚΩΝ ΜΑΣ annotation symbols → **built-in σύμβολα
 * του Τέκτονα** (`obj/symbols`, type-7 `<object>` `type_res` index). SSoT για τον
 * «native» τρόπο εξαγωγής: κάθε σύμβολο με equivalent γίνεται ΕΝΑ επιλέξιμο πακέτο.
 *
 * Οι δείκτες προέρχονται από τον πραγματικό κατάλογο `Obj.inf` της εγκατάστασης
 * Fespa-Tekton v9.1 (obj/symbols):
 *   51 = «Βορράς 1» · 124 = «Βορράς 2» · 127 = «Βορράς 3» · 137 = «Βορράς 4»
 *   123 = «Σήμα στάθμης 1» · 125 = «Σήμα στάθμης 2» · 126 = «Βέλος εισόδου»
 *   383 = «Σύμβολο τομής» · 380/381/382 = «Βέλος φοράς 1/2/3»
 *
 * Σύμβολα ΧΩΡΙΣ built-in equivalent (grid-bubble / detail-callout / revision-tag /
 * scale-bar) επιστρέφουν `undefined` → ο exporter τα κρατά ως αυτούσια γεωμετρία.
 *
 * @see export/core/tek/dxf-to-tek.ts — collectTekObjects (καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { AnnotationSymbolKind } from '../../../types/annotation-symbol';

/** Ανά-`symbolId` override (πιο συγκεκριμένο του kind· π.χ. οι παραλλαγές βορρά). */
const TYPE_RES_BY_SYMBOL_ID: Readonly<Record<string, number>> = {
  northArrowSimple: 51, // Βορράς 1
  northArrowStar: 124, // Βορράς 2
  northArrowCompass: 137, // Βορράς 4 (ροζέτα με σημεία)
  northArrowCircledN: 127, // Βορράς 3
  sectionMarkArrow: 383, // Σύμβολο τομής
  sectionMarkSplit: 383, // Σύμβολο τομής
  elevationLevel: 123, // Σήμα στάθμης 1
  elevationTag: 125, // Σήμα στάθμης 2
};

/** Fallback ανά `kind` όταν λείπει override συγκεκριμένου `symbolId`. */
const TYPE_RES_BY_KIND: Partial<Readonly<Record<AnnotationSymbolKind, number>>> = {
  'north-arrow': 51, // Βορράς 1
  'section-mark': 383, // Σύμβολο τομής
  'elevation-mark': 123, // Σήμα στάθμης 1
  // grid-bubble / detail-callout / revision-tag → κανένα built-in → αυτούσια γεωμετρία.
};

/**
 * Ο Tekton `type_res` για ένα δικό μας σύμβολο, ή `undefined` αν δεν υπάρχει
 * built-in equivalent (→ ο exporter το αποδομεί σε αυτούσια γεωμετρία). Προτεραιότητα
 * στο `symbolId` override, μετά στο `kind`.
 */
export function tekSymbolTypeRes(
  kind: AnnotationSymbolKind, symbolId: string | undefined,
): number | undefined {
  if (symbolId && symbolId in TYPE_RES_BY_SYMBOL_ID) return TYPE_RES_BY_SYMBOL_ID[symbolId];
  return TYPE_RES_BY_KIND[kind];
}
