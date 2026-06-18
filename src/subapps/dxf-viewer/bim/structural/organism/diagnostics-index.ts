/**
 * diagnostics-index — κοινός indexer ευρημάτων ανά entityId (N.0.2 SSoT).
 *
 * Εξήχθη από τον `StructuralDiagnosticsStore` ώστε να τον μοιράζονται ΟΛΟΙ οι
 * diagnostics stores (organism ADR-459 + static analysis ADR-482) χωρίς copy-paste.
 * Ένα εύρημα φαίνεται σε ΟΛΑ τα `entityIds` του.
 *
 * Pure — zero React/DOM.
 *
 * @see ./structural-diagnostics-store.ts — ο πρώτος consumer
 * @see ../analytical/analysis-diagnostics-store.ts — ο δεύτερος consumer
 */

import type { StructuralDiagnostic } from './structural-organism-types';

/** Index ανά εμπλεκόμενο entityId (ένα εύρημα → σε όλα τα entityIds του). */
export function indexDiagnosticsByEntity(
  diagnostics: readonly StructuralDiagnostic[],
): ReadonlyMap<string, readonly StructuralDiagnostic[]> {
  const map = new Map<string, StructuralDiagnostic[]>();
  for (const d of diagnostics) {
    for (const id of d.entityIds) {
      const bucket = map.get(id);
      if (bucket) bucket.push(d);
      else map.set(id, [d]);
    }
  }
  return map;
}
