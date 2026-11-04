/**
 * @fileoverview **Πού χρησιμοποιείται μια ρήτρα** — η επίπτωση πριν από κάθε απόφαση βιβλιοθήκης (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/clause-usage
 *
 * 🔑 Πρότυπα: δένουν με το **κλειδί** (παίρνουν την έκδοση σε ισχύ τη στιγμή του «Νέο»), άρα μια έγκριση τα αλλάζει
 *    για κάθε **μελλοντικό** συμφωνητικό. Πρόχειρα: δένουν με **έκδοση**· όσα μένουν σε παλιότερη από την έκδοση σε
 *    ισχύ δείχνουν «νέα έκδοση διαθέσιμη» (ενημέρωση **μέσα** στο συμφωνητικό, `upgradeClauseVersion`). Εκδοθέντα δεν
 *    μετρούν εδώ: ό,τι υπογράφηκε δεν αλλάζει ποτέ (§5.6).
 */

import type { SubcontractAgreement } from '../types/agreement';
import type { ClauseKey } from '../types/clause';
import type { SubcontractTradeTemplate } from '../types/trade-template';

export interface DraftClauseUse {
  readonly agreement: Pick<SubcontractAgreement, 'id' | 'documentNumber' | 'title'>;
  readonly pinnedVersion: number;
  /** Καρφωμένο σε παλιότερη από την έκδοση σε ισχύ. */
  readonly behind: boolean;
}

export interface ClauseUsage {
  readonly templates: readonly Pick<SubcontractTradeTemplate, 'id' | 'code' | 'title'>[];
  readonly drafts: readonly DraftClauseUse[];
}

/** `currentVersion`: η έκδοση σε ισχύ της ρήτρας (`null` = καμία ακόμη ⇒ κανένα πρόχειρο δεν είναι «πίσω»). */
export function clauseUsageOf(
  clauseKey: ClauseKey,
  currentVersion: number | null,
  templates: readonly Pick<SubcontractTradeTemplate, 'id' | 'code' | 'title' | 'clauses'>[],
  drafts: readonly Pick<SubcontractAgreement, 'id' | 'documentNumber' | 'title' | 'status' | 'clauses'>[],
): ClauseUsage {
  return {
    templates: templates.filter((template) => template.clauses.some((ref) => ref.clauseKey === clauseKey)),
    drafts: drafts.flatMap((agreement): DraftClauseUse[] => {
      if (agreement.status !== 'draft') return [];
      const selection = agreement.clauses.find((candidate) => candidate.clauseKey === clauseKey);
      if (!selection) return [];
      const behind = currentVersion !== null && selection.version < currentVersion;
      return [{ agreement, pinnedVersion: selection.version, behind }];
    }),
  };
}
