/**
 * @fileoverview **Ποιες πράξεις βιβλιοθήκης προσφέρονται στον θεατή, και γιατί όχι οι άλλες** — καθαρό (ADR-928 Φ3γ-0).
 * @module subapps/procurement/subcontracts/library/library-action-blocks
 *
 * 🔑 **Οι ίδιοι φύλακες με τον γραφέα** (`clause-governance-writer.server.ts`, `clause-translation-writer.server.ts`),
 *    στην ίδια σειρά: δικαίωμα · κατάσταση/ταυτότητα από το `clause-governance.ts`. Κανένας κανόνας δεν ξαναγράφεται
 *    εδώ· μόνο η μετάφραση της άρνησης σε **αιτία που λέγεται** στην οθόνη (Ironclad κρύβει, εμείς εξηγούμε).
 * 🔑 Δύο είδη αιτίας: `hidden` (η πράξη δεν αφορά αυτή την έκδοση — π.χ. έγκριση σε εγκεκριμένη) και `explained`
 *    (η πράξη αφορά, αλλά ο θεατής δεν μπορεί — π.χ. «την πρότεινες εσύ»). Μόνο οι δεύτερες φαίνονται ως ανενεργό κουμπί.
 */

import {
  refuseApproval,
  refuseRejection,
  refuseReviewMark,
  refuseTranslationApproval,
  refuseTranslationProposal,
  refuseWithdrawal,
} from '../clauses/clause-governance';
import type { ClauseTranslation, SubcontractClauseVersion } from '../types/clause';

export type LibraryAction = 'approve' | 'reject' | 'withdraw' | 'markReviewed' | 'proposeTranslation' | 'approveTranslation';

/** Αιτία που **λέγεται** δίπλα στο ανενεργό κουμπί. */
export type LibraryActionReason = 'notAuthorized' | 'ownProposal' | 'ownTranslation' | 'translationStale';

export type LibraryActionBlock = { readonly kind: 'hidden' } | { readonly kind: 'explained'; readonly reason: LibraryActionReason };

export interface LibraryActionContext {
  readonly actorUid: string;
  /** `subcontracts:clauses:manage` — έγκριση, απόρριψη, νομικός έλεγχος, έγκριση μετάφρασης. */
  readonly canManage: boolean;
  /** `subcontracts:clauses:propose` — απόσυρση, πρόταση μετάφρασης. */
  readonly canPropose: boolean;
}

type VersionFacts = Pick<SubcontractClauseVersion, 'state' | 'proposedBy' | 'professionalReview' | 'sourceHash'>;

const HIDDEN: LibraryActionBlock = { kind: 'hidden' };
const explained = (reason: LibraryActionReason): LibraryActionBlock => ({ kind: 'explained', reason });

/** Η άρνηση του φύλακα (κατάσταση/ταυτότητα) γίνεται αιτία οθόνης· `invalidTransition` = η πράξη δεν αφορά. */
function fromRefusal(refusal: string | null, own: LibraryActionReason): LibraryActionBlock | null {
  if (refusal === null) return null;
  if (refusal === 'selfApproval') return explained(own);
  if (refusal === 'translationStale') return explained('translationStale');
  return HIDDEN;
}

/** Δικαίωμα μετά την κατάσταση: πράξη που δεν αφορά την έκδοση κρύβεται, ακόμη και χωρίς δικαίωμα. */
function gated(stateRefusal: LibraryActionBlock | null, granted: boolean): LibraryActionBlock | null {
  if (stateRefusal?.kind === 'hidden') return stateRefusal;
  if (!granted) return explained('notAuthorized');
  return stateRefusal;
}

export function versionActionBlock(
  action: Exclude<LibraryAction, 'approveTranslation'>,
  version: VersionFacts,
  context: LibraryActionContext,
): LibraryActionBlock | null {
  switch (action) {
    case 'approve':
      return gated(fromRefusal(refuseApproval(version, context.actorUid), 'ownProposal'), context.canManage);
    case 'reject':
      return gated(fromRefusal(refuseRejection(version), 'ownProposal'), context.canManage);
    case 'withdraw':
      // Η απόσυρση ανήκει **μόνο** στον προτείνοντα: για όλους τους άλλους δεν αφορά (κρύβεται).
      return refuseWithdrawal(version, context.actorUid) === null ? gated(null, context.canPropose) : HIDDEN;
    case 'markReviewed':
      return gated(fromRefusal(refuseReviewMark(version), 'ownProposal'), context.canManage);
    case 'proposeTranslation':
      return gated(fromRefusal(refuseTranslationProposal(version), 'ownProposal'), context.canPropose);
  }
}

export function translationApprovalBlock(
  version: VersionFacts,
  translation: Pick<ClauseTranslation, 'status' | 'sourceHash' | 'proposedBy'>,
  context: LibraryActionContext,
): LibraryActionBlock | null {
  return gated(fromRefusal(refuseTranslationApproval(version, translation, context.actorUid), 'ownTranslation'), context.canManage);
}
