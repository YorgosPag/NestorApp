/**
 * @fileoverview **Ποιες πράξεις βιβλιοθήκης προσφέρονται στον θεατή, και γιατί όχι οι άλλες** — καθαρό (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/library-action-blocks
 *
 * 🔑 **Οι ίδιοι φύλακες με τον γραφέα** (`clause-governance-writer.server.ts`, `clause-translation-writer.server.ts`),
 *    στην ίδια σειρά: δικαίωμα · κατάσταση/ταυτότητα από το `clause-governance.ts`. Κανένας κανόνας δεν ξαναγράφεται
 *    εδώ· μόνο η μετάφραση της άρνησης σε **αιτία που λέγεται** στην οθόνη (Ironclad κρύβει, εμείς εξηγούμε).
 * 🔑 Τρία είδη: `hidden` (η πράξη δεν αφορά αυτή την έκδοση — π.χ. έγκριση σε εγκεκριμένη), `explained` (η πράξη
 *    αφορά, αλλά ο θεατής δεν μπορεί — π.χ. «την πρότεινες εσύ») και `pending` (η κρίση δικαιώματος **δεν ήρθε ακόμη**:
 *    ανενεργό κουμπί **χωρίς** αιτία — το «δεν έχεις δικαίωμα» σε κάθε φόρτωση ήταν ψευδές, ADR-928 §5.20 απόφαση 9).
 */

import {
  refuseApproval,
  refuseRejection,
  refuseReviewMark,
  refuseTranslationApproval,
  refuseTranslationProposal,
  refuseWithdrawal,
} from '../clauses/clause-governance';
import type { ClauseTranslation, SubcontractClause, SubcontractClauseVersion } from '../types/clause';

export type LibraryAction = 'approve' | 'reject' | 'withdraw' | 'markReviewed' | 'proposeTranslation' | 'approveTranslation';

/** Αιτία που **λέγεται** δίπλα στο ανενεργό κουμπί. */
export type LibraryActionReason = 'notAuthorized' | 'ownProposal' | 'ownTranslation' | 'translationStale' | 'proposalPending';

export type LibraryActionBlock =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'explained'; readonly reason: LibraryActionReason };

export interface LibraryActionContext {
  readonly actorUid: string;
  /** `subcontracts:clauses:manage` — έγκριση, απόρριψη, νομικός έλεγχος, έγκριση μετάφρασης. */
  readonly canManage: boolean;
  /** `subcontracts:clauses:propose` — απόσυρση, πρόταση μετάφρασης. */
  readonly canPropose: boolean;
  /** Η κρίση δικαιώματος δεν ήρθε ακόμη (`useSubcontractLibraryAuthority().pending`). */
  readonly pending: boolean;
}

type VersionFacts = Pick<SubcontractClauseVersion, 'state' | 'proposedBy' | 'professionalReview' | 'sourceHash'>;
type Grant = 'canManage' | 'canPropose';

const HIDDEN: LibraryActionBlock = { kind: 'hidden' };
const PENDING: LibraryActionBlock = { kind: 'pending' };
const explained = (reason: LibraryActionReason): LibraryActionBlock => ({ kind: 'explained', reason });

/** Η άρνηση του φύλακα (κατάσταση/ταυτότητα) γίνεται αιτία οθόνης· `invalidTransition` = η πράξη δεν αφορά. */
function fromRefusal(refusal: string | null, own: LibraryActionReason): LibraryActionBlock | null {
  if (refusal === null) return null;
  if (refusal === 'selfApproval') return explained(own);
  if (refusal === 'translationStale') return explained('translationStale');
  return HIDDEN;
}

/**
 * Δικαίωμα μετά την κατάσταση: πράξη που δεν αφορά την έκδοση κρύβεται, ακόμη και χωρίς δικαίωμα. Όσο η κρίση εκκρεμεί,
 * `pending` — ποτέ «δεν έχεις δικαίωμα» πριν απαντήσει ο κριτής.
 */
function gated(stateRefusal: LibraryActionBlock | null, grant: Grant, context: LibraryActionContext): LibraryActionBlock | null {
  if (stateRefusal?.kind === 'hidden') return stateRefusal;
  if (!context[grant]) return context.pending ? PENDING : explained('notAuthorized');
  return stateRefusal;
}

export function versionActionBlock(
  action: Exclude<LibraryAction, 'approveTranslation'>,
  version: VersionFacts,
  context: LibraryActionContext,
): LibraryActionBlock | null {
  switch (action) {
    case 'approve':
      return gated(fromRefusal(refuseApproval(version, context.actorUid), 'ownProposal'), 'canManage', context);
    case 'reject':
      return gated(fromRefusal(refuseRejection(version), 'ownProposal'), 'canManage', context);
    case 'withdraw':
      // Η απόσυρση ανήκει **μόνο** στον προτείνοντα: για όλους τους άλλους δεν αφορά (κρύβεται).
      return refuseWithdrawal(version, context.actorUid) === null ? gated(null, 'canPropose', context) : HIDDEN;
    case 'markReviewed':
      return gated(fromRefusal(refuseReviewMark(version), 'ownProposal'), 'canManage', context);
    case 'proposeTranslation':
      return gated(fromRefusal(refuseTranslationProposal(version), 'ownProposal'), 'canPropose', context);
  }
}

export function translationApprovalBlock(
  version: VersionFacts,
  translation: Pick<ClauseTranslation, 'status' | 'sourceHash' | 'proposedBy'>,
  context: LibraryActionContext,
): LibraryActionBlock | null {
  return gated(fromRefusal(refuseTranslationApproval(version, translation, context.actorUid), 'ownTranslation'), 'canManage', context);
}

/**
 * Οι πόρτες του επεξεργαστή προτύπου (ADR-928 §5.22): «Νέο πρότυπο» και «Επεξεργασία» — ο φύλακας του γραφέα είναι
 * `subcontracts:templates:manage`. Αρχειοθετημένο πρότυπο ⇒ καμία «Επεξεργασία» (πρώτα επαναφορά).
 */
export function templateAuthoringBlock(
  template: { readonly isArchived: boolean } | null,
  authority: { readonly canManageTemplates: boolean; readonly pending: boolean },
): LibraryActionBlock | null {
  if (template?.isArchived) return HIDDEN;
  if (authority.canManageTemplates) return null;
  return authority.pending ? PENDING : explained('notAuthorized');
}

/** Οι πόρτες της συγγραφής (ADR-928 §5.22): «Νέα ρήτρα» και «Πρότεινε αλλαγή». */
export type LibraryAuthoringAction = 'createClause' | 'proposeChange';

/**
 * Ο **ίδιος** φύλακας με τον γραφέα: `subcontracts:clauses:propose` + **μία** ανοιχτή πρόταση ανά ρήτρα (409
 * `proposalPending`, Φ1 απόφαση 3). Η αρχειοθετημένη ρήτρα δεν δέχεται πρόταση από την οθόνη: πρώτα επαναφορά.
 */
export function authoringActionBlock(
  action: LibraryAuthoringAction,
  clause: Pick<SubcontractClause, 'openProposal' | 'isArchived'> | null,
  context: LibraryActionContext,
): LibraryActionBlock | null {
  if (action === 'proposeChange' && (clause === null || clause.isArchived)) return HIDDEN;
  const state = action === 'proposeChange' && clause?.openProposal !== null ? explained('proposalPending') : null;
  return gated(state, 'canPropose', context);
}
