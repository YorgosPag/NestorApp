/**
 * @fileoverview **«Τι μπορεί να αποφασίσει το γραφείο για αυτό το αρχείο — και επιτρέπεται αυτό που ζήτησε;»**
 *   (ADR-916 §5.18 Φ-Δ.4).
 * @related lib/property-handover/handover-disposition.ts (η ΜΙΑ κρίση κατάταξης) ·
 *          services/property-handover/property-handover-file-decision.service.ts (ο γραφέας που τη ρωτά ΜΕΣΑ στη συναλλαγή)
 * @module lib/property-handover/handover-file-decision-plan
 *
 * 🔑 **Μία κρίση για κουμπί ΚΑΙ πόρτα** (πρότυπο Φ-Δ.3 `handoverInvitationRenewalOfferOf`): ο διάλογος δείχνει **μόνο**
 *    ό,τι η πόρτα θα δεχτεί — η οθόνη δεν μπορεί να υποσχεθεί κάτι που ο διακομιστής θα αρνηθεί (άγκυρα Ζ29).
 *
 * ⚖️ **Τρία όρια, από τους μεγάλους**:
 *   1. **Ό,τι παραδόθηκε μένει** (Δ5 · ACC Transmittals: ό,τι στάλθηκε είναι νομικό αρχείο). Σε αρχείο που υπάρχει ήδη στο
 *      καθολικό, προσφέρεται **μόνο** ό,τι καταλήγει σε `deliver`. Η απόσυρση είναι δική της πράξη (Φ-Δ.7).
 *   2. **Εμπιστευτικό ⇒ παραδίδεται μόνο με ρητή επιβεβαίωση** (Purview DLP override με αιτιολόγηση).
 *   3. **Optimistic concurrency**: ο άνθρωπος στέλνει την απόφαση που **είδε**· άλλη ⇒ `stale` (ETag / If-Match).
 *
 * **Layering**: leaf — καμία εξάρτηση από Firestore ή React.
 */

import { FILE_CLASSIFICATIONS } from '@/config/domain-constants';
import {
  HANDOVER_FILE_DECISION_CHOICES,
  type HandoverFileDecisionChoice,
  type HandoverFileDecisionDisposition,
  type HandoverFileDecisionOffer,
  type HandoverFileDecisionRefusal,
  type HandoverFileDecisionRequest,
} from '@/types/property-handover-file-decision';

import { automaticHandoverDispositionOf, isHandoverEligible, type HandoverCandidateFile } from './handover-disposition';

/** Ό,τι χρειάζεται η κρίση: το αρχείο όπως διαβάστηκε (`null` = αδιάβαστο) και «υπάρχει ήδη στο καθολικό;». */
export interface HandoverFileDecisionState {
  readonly candidate: HandoverCandidateFile | null;
  /** Υπάρχει γραμμή καθολικού για αυτή την πηγή σε **οποιαδήποτε** παράδοση του ακινήτου. */
  readonly delivered: boolean;
}

export type HandoverFileDecisionVerdict =
  /** `next: null` ⇒ σβήσε την απόφαση (επιστροφή στον κανόνα). */
  | { readonly kind: 'apply'; readonly next: HandoverFileDecisionDisposition | null }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: HandoverFileDecisionRefusal };

const currentDecisionOf = (candidate: HandoverCandidateFile): HandoverFileDecisionDisposition | null =>
  candidate.handoverDecision?.disposition ?? null;

/** Είναι αυτή η επιλογή η κατάσταση που **ήδη** ισχύει; */
function isCurrentChoice(candidate: HandoverCandidateFile, choice: HandoverFileDecisionChoice): boolean {
  const current = currentDecisionOf(candidate);
  return choice === 'automatic' ? current === null : current === choice;
}

/** **Η προσφορά** για ένα αρχείο του συνόλου — ό,τι δείχνει ο διάλογος. */
export function handoverFileDecisionOfferOf(state: HandoverFileDecisionState): HandoverFileDecisionOffer {
  const { candidate, delivered } = state;
  if (candidate === null) return { kind: 'blocked', reason: 'unrecognised' };
  if (candidate.handoverProtocolOf !== undefined) return { kind: 'blocked', reason: 'protocol-file' };
  const automatic = automaticHandoverDispositionOf(candidate);
  const outcomeOf = (choice: HandoverFileDecisionChoice) => (choice === 'automatic' ? automatic : choice);
  const choices = HANDOVER_FILE_DECISION_CHOICES.filter(
    (choice) => !isCurrentChoice(candidate, choice) && (!delivered || outcomeOf(choice) === 'deliver'),
  );
  if (choices.length === 0) return { kind: 'blocked', reason: 'already-delivered' };
  return {
    kind: 'open',
    choices,
    automatic,
    deliverNeedsConfirmation: candidate.classification === FILE_CLASSIFICATIONS.CONFIDENTIAL,
  };
}

/**
 * **Η κρίση της πόρτας** — την ξανατρέχει ο γραφέας **μέσα** στη συναλλαγή, πάνω στο φρέσκο έγγραφο.
 * Σειρά: αδιάβαστο · ανεπίλεκτο · Πρωτόκολλο · ήδη ισχύει (ιδεμπότητα **πριν** το `stale`: μια επανάληψη μετά από
 * επιτυχία στέλνει το παλιό `expected` και πρέπει να πάρει «καμία αλλαγή», όχι άρνηση) · `stale` · καθολικό · επιβεβαίωση.
 */
export function handoverFileDecisionOf(
  state: HandoverFileDecisionState,
  request: Pick<HandoverFileDecisionRequest, 'choice' | 'expected' | 'confirmConfidential'>,
): HandoverFileDecisionVerdict {
  const { candidate } = state;
  if (candidate === null) return { kind: 'refused', reason: 'unrecognised' };
  if (!isHandoverEligible(candidate)) return { kind: 'refused', reason: 'file-unknown' };
  if (candidate.handoverProtocolOf !== undefined) return { kind: 'refused', reason: 'protocol-file' };
  if (isCurrentChoice(candidate, request.choice)) return { kind: 'unchanged' };
  if (request.expected !== currentDecisionOf(candidate)) return { kind: 'refused', reason: 'stale' };
  const offer = handoverFileDecisionOfferOf(state);
  if (offer.kind === 'blocked' || !offer.choices.includes(request.choice)) return { kind: 'refused', reason: 'already-delivered' };
  if (request.choice === 'deliver' && offer.deliverNeedsConfirmation && !request.confirmConfidential) {
    return { kind: 'refused', reason: 'confidential-unconfirmed' };
  }
  return { kind: 'apply', next: request.choice === 'automatic' ? null : request.choice };
}
