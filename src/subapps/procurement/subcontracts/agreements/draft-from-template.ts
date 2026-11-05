/**
 * @fileoverview **Πρότυπο ειδικότητας → πρόχειρο συμφωνητικού** (ADR-928 §5.3 · §5.9 · Φ3γ).
 * @module subapps/procurement/subcontracts/agreements/draft-from-template
 *
 * 🔑 Η φόρμα **παράγεται** από το πρότυπο: γραμμές, όροι, τρόπος έκδοσης, τίτλος, ρήτρες με τις τιμές του προτύπου.
 * 🔑 Κάθε ρήτρα καρφώνεται στην έκδοση **σε ισχύ** της βιβλιοθήκης (Φ2 απόφαση 5) — η ίδια που θα ζητήσει ο γραφέας.
 *    Ρήτρα χωρίς έκδοση σε ισχύ (ή άγνωστη/αρχειοθετημένη) **δεν μαντεύεται**: μένει έξω και αναφέρεται στο `unresolved`,
 *    ώστε η οθόνη να το πει πριν από τη δημιουργία.
 * 🔑 Τιμές του προτύπου μόνο για παραμέτρους **της ρήτρας** (`source: clause`): οι δεσμευμένες ζουν στους όρους, και ο
 *    γραφέας θα αρνιόταν τιμή γι' αυτές (`overrideOnBoundParameter`).
 */

import type { ClauseKey } from '../types/clause';
import type { ClauseParameterValue } from '../types/clause-parameter';
import type { SubcontractTradeTemplate, TemplateClauseRef } from '../types/trade-template';
import type { AgreementScopeInput, SubcontractAgreementDraftInput } from './agreement-draft';
import type { ApprovedLibrary, ClauseInForce, ClauseSelectionInput } from './judge-deviations';

export interface DraftFromTemplateChoice {
  readonly scope: AgreementScopeInput;
  readonly subcontractorContactId: string;
}

export interface DraftFromTemplate {
  readonly draft: SubcontractAgreementDraftInput;
  /** Ρήτρες του προτύπου που δεν μπήκαν: η βιβλιοθήκη δεν έχει γι' αυτές έκδοση σε ισχύ. */
  readonly unresolved: readonly ClauseKey[];
}

/** Οι τιμές του προτύπου που ανήκουν στη ρήτρα (όχι στους όρους). */
function clauseOwnedOverrides(ref: TemplateClauseRef, inForce: ClauseInForce): Record<string, ClauseParameterValue> {
  const owned = new Set(inForce.parameters.filter((parameter) => parameter.source.kind === 'clause').map((parameter) => parameter.key));
  return Object.fromEntries(Object.entries(ref.parameterOverrides).filter(([key]) => owned.has(key)));
}

/** Οι ρήτρες ενός προτύπου ως επιλογές, στην έκδοση σε ισχύ — ο **ένας** δρόμος για το «Νέο» και το δείγμα εγγράφου (§5.22). */
export function templateClauseInputsOf(refs: readonly TemplateClauseRef[], library: ApprovedLibrary): { inputs: ClauseSelectionInput[]; unresolved: ClauseKey[] } {
  const inputs: ClauseSelectionInput[] = [];
  const unresolved: ClauseKey[] = [];
  for (const ref of refs) {
    const inForce = library.get(ref.clauseKey);
    if (!inForce) unresolved.push(ref.clauseKey);
    else inputs.push({ clauseKey: ref.clauseKey, version: inForce.version, parameterValues: clauseOwnedOverrides(ref, inForce), deviationReasons: {} });
  }
  return { inputs, unresolved };
}

/** Το πρόχειρο που στέλνει το «Νέο» — απευθείας δημιουργία (§5.9 δρόμος 1), χωρίς οικοπεδούχους και δεύτερη γλώσσα. */
export function draftFromTemplate(
  template: SubcontractTradeTemplate,
  library: ApprovedLibrary,
  choice: DraftFromTemplateChoice,
): DraftFromTemplate {
  const { inputs, unresolved } = templateClauseInputsOf(template.clauses, library);
  return {
    draft: {
      documentMode: template.defaultDocumentMode,
      origin: { kind: 'direct' },
      trade: template.trade,
      templateId: template.id,
      title: template.title,
      scope: choice.scope,
      subcontractorContactId: choice.subcontractorContactId,
      projectOwners: { kind: 'none' },
      issuerSignatory: null,
      lines: template.lines,
      terms: template.defaultTerms,
      clauses: inputs,
      languages: { secondary: null },
      validUntil: null,
    },
    unresolved,
  };
}
