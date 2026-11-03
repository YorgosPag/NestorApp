/**
 * @fileoverview **Η ζωντανή κρίση ενός πρόχειρου** — οι ΙΔΙΟΙ κριτές με τον γραφέα, στην ίδια σειρά (ADR-928 Φ3γ).
 * @module subapps/procurement/subcontracts/agreements/judge-agreement-draft
 *
 * 🔑 Ο γραφέας τρέχει `validateAgreementDraft` πριν από τη συναλλαγή και `judgeClauseSelections` μέσα σε αυτήν
 *    (`prepareDraft` + `resolveAgreementContent`, με `previous` = οι αποθηκευμένες επιλογές). Η οθόνη τρέχει **τις ίδιες
 *    συναρτήσεις** με τη βιβλιοθήκη που έφτασε ζωντανά (`approvedLibraryFrom` — ίδια προβολή, Φ3α-2 απόφαση 3).
 * 🔑 Ο άνθρωπος βλέπει **όλα** τα ευρήματα μαζί (επικύρωση + ρήτρες)· ο γραφέας σταματά στην πρώτη ομάδα, άρα η οθόνη
 *    λέει ό,τι θα έλεγε ο διακομιστής **και** ό,τι θα έλεγε στην επόμενη προσπάθεια.
 * ⚠️ Τα ευρήματα μερών που θέλουν ανάγνωση πηγής (`issuerProfileMissing` · `contactUnknown` για ξένη επαφή ·
 *    `buildingNotInProject`) τα λέει μόνο ο γραφέας — φτάνουν με την ίδια λέξη στο 422.
 */

import type { CalendarDay } from '@/constants/platform-operator';
import type { SubcontractIssue } from '../clauses/clause-issues';
import type { ClauseSelection } from '../types/commercial-terms';
import { validateAgreementDraft, type SubcontractAgreementDraftInput } from './agreement-draft';
import { judgeClauseSelections, type ApprovedLibrary } from './judge-deviations';

export interface DraftJudgementContext {
  readonly library: ApprovedLibrary;
  /** Οι αποθηκευμένες επιλογές — ο κριτής κρατά τις αποφάσεις αποκλίσεων όπου η τιμή και ο λόγος δεν άλλαξαν. */
  readonly previous: readonly ClauseSelection[];
  readonly actorUid: string;
  /** Ημερολογιακή μέρα Ελλάδας (`todayLocalDate`). */
  readonly today: CalendarDay;
}

export interface DraftJudgement {
  readonly issues: readonly SubcontractIssue[];
  /** Οι επιλογές όπως θα τις γράψει ο γραφέας — με τις αποκλίσεις που γεννά ή κρατά η αποθήκευση. */
  readonly selections: readonly ClauseSelection[];
}

export function judgeAgreementDraft(draft: SubcontractAgreementDraftInput, context: DraftJudgementContext): DraftJudgement {
  const validation = validateAgreementDraft(draft, context.today);
  const judged = judgeClauseSelections(draft.clauses, context.library, draft.terms, context.previous, { uid: context.actorUid });
  return { issues: [...validation, ...judged.issues], selections: judged.selections };
}
