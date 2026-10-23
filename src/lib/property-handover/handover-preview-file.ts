/**
 * @fileoverview **Η γραμμή ενός αρχείου στην καρτέλα «Παράδοση»** — από την κρίση, όχι από το χέρι (ADR-916 §5.18 Φ-Δ.4).
 * @related services/property-handover/property-handover-set.server.ts (ο διακομιστής) ·
 *          components/property-handover-office/testing (η γκαλερί — η ΙΔΙΑ σύνθεση πάνω σε συνθετικά αρχεία)
 * @module lib/property-handover/handover-preview-file
 *
 * 🔑 **Μία σύνθεση, δύο καταναλωτές**: ο διακομιστής και η γκαλερί περνούν από **εδώ** ⇒ ό,τι βλέπει ο άνθρωπος στη γκαλερί
 *    είναι ό,τι θα του δείξει η πόρτα — και η προσφορά βγαίνει από την **ίδια** κρίση που εφαρμόζει ο γραφέας (Ζ29).
 * 🔒 Ποτέ το `decidedBy` (uid): η όψη χρειάζεται «τι, γιατί, πότε».
 *
 * **Layering**: leaf — καμία εξάρτηση από Firestore ή React.
 */

import { FILE_CLASSIFICATIONS } from '@/config/domain-constants';
import type { PropertyHandoverPreviewFile, PropertyHandoverSetFileIdentity } from '@/types/property-handover';

import { handoverDispositionBasisOf, type HandoverCandidateFile } from './handover-disposition';
import { handoverFileDecisionOfferOf } from './handover-file-decision-plan';

/** Ό,τι ξέρει ο καλών για το έγγραφο πέρα από την κρίση. */
export type HandoverFileLabel = Pick<PropertyHandoverSetFileIdentity, 'fileId' | 'displayName' | 'entityType' | 'entityId'>;

/** Η ταυτότητα + ο λόγος κατάταξης — από την **ίδια** κρίση που μοιράζει τα αρχεία (καμία δεύτερη αλυσίδα). */
export function handoverSetFileIdentityOf(label: HandoverFileLabel, candidate: HandoverCandidateFile | null): PropertyHandoverSetFileIdentity {
  const decision = candidate?.handoverDecision;
  return {
    ...label,
    basis: candidate === null ? 'unrecognised' : handoverDispositionBasisOf(candidate).basis,
    decision: decision === undefined ? null : { disposition: decision.disposition, reason: decision.reason, decidedAt: decision.decidedAt },
    confidential: candidate?.classification === FILE_CLASSIFICATIONS.CONFIDENTIAL,
  };
}

/** Η γραμμή της προεπισκόπησης — η ταυτότητα, «παραδόθηκε;» και η προσφορά της Φ-Δ.4. */
export function handoverPreviewFileOf(
  identity: PropertyHandoverSetFileIdentity,
  candidate: HandoverCandidateFile | null,
  delivered: boolean,
): PropertyHandoverPreviewFile {
  return { ...identity, delivered, offer: handoverFileDecisionOfferOf({ candidate, delivered }) };
}
