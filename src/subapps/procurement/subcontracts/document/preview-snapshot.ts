/**
 * @fileoverview **Το στιγμιότυπο της προεπισκόπησης** — ένα πρόχειρο όπως θα παγώσει στο `issue` (ADR-928 §5.17).
 * @module subapps/procurement/subcontracts/document/preview-snapshot
 *
 * 🔑 Οι **ίδιες** συναρτήσεις με τον γραφέα (`frozenClauseOf` · `buildAgreementSnapshot`): η προεπισκόπηση δεν έχει
 *    δική της ιδέα για το τι παγώνει. Η μόνη διαφορά είναι η πηγή των εκδόσεων (ζωντανή ανάγνωση αντί για συναλλαγή).
 * 🔑 Fail-visible: ρήτρα της οποίας η καρφωμένη έκδοση **δεν** είναι η σε ισχύ (ή δεν έφτασε ακόμη) δεν μαντεύεται·
 *    επιστρέφεται στο `unavailable` και η οθόνη το λέει.
 */

import { pinnedClauseOf } from '../agreements/approved-library';
import { buildAgreementSnapshot, frozenClauseOf } from '../agreements/agreement-snapshot';
import type { FrozenClause, SubcontractAgreement, SubcontractAgreementSnapshot } from '../types/agreement';
import type { SubcontractClause, SubcontractClauseVersion } from '../types/clause';

export interface PreviewSnapshot {
  readonly snapshot: SubcontractAgreementSnapshot;
  /** Κλειδιά ρητρών που δεν μπορούν να αποδοθούν με την έκδοση που καρφώθηκε. */
  readonly unavailable: readonly string[];
}

export function previewSnapshotOf(
  agreement: SubcontractAgreement,
  clauses: readonly SubcontractClause[],
  versionsByClauseId: ReadonlyMap<string, SubcontractClauseVersion>,
): PreviewSnapshot {
  const byId = new Map(clauses.map((clause) => [clause.id, clause]));
  const frozen: FrozenClause[] = [];
  const unavailable: string[] = [];
  for (const selection of agreement.clauses) {
    const clause = byId.get(selection.clauseId);
    const pinned = clause ? pinnedClauseOf(clause, versionsByClauseId) : null;
    if (pinned && pinned.version.version === selection.version) frozen.push(frozenClauseOf(selection, pinned, agreement.terms));
    else unavailable.push(selection.clauseKey);
  }
  return { snapshot: buildAgreementSnapshot(agreement, frozen), unavailable };
}
