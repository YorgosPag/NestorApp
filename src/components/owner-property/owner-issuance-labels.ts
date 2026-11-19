/**
 * @fileoverview ADR-945 §7.6 — **οι λέξεις του αιτήματος προσφορών του ιδιώτη**: κάθε χάρτης δεμένος στο κλειστό
 *   λεξιλόγιο του πυρήνα (αρνήσεις `ISSUANCE_REQUEST_REFUSALS` · χρονολόγιο `BID_TIMELINE_KINDS` · μπάλα ιδιώτη) — νέα
 *   τιμή **δεν μεταγλωττίζεται** χωρίς λέξη (CHECK 3.73).
 * @related components/document-registry/issuance-labels.ts (στάδια στη φωνή του γραφείου — εδώ στη φωνή του ιδιώτη) ·
 *   lib/document-validity/issuance-request-view-model.ts
 * @module components/owner-property/owner-issuance-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά (CHECK 3.34).
 * 🔑 Η ενότητα φορτώνεται με `next/dynamic` ⇒ οι λέξεις της δεν βαραίνουν το πρώτο καρέ της σελίδας.
 */

import type { IssuanceRequestServiceRefusal } from '@/lib/document-validity/issuance-bidding-request';
import type { BidTimelineKind, OwnerBallParty } from '@/lib/document-validity/issuance-request-view-model';
import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';

const K = 'document-registry:ownerIssuance.';

/** Τα namespaces της ενότητας — ετικέτες είδους ζουν στο `conveyance` / `legality` (`DOCUMENT_KIND_LABEL_KEYS`). */
export const OWNER_ISSUANCE_NAMESPACES = ['document-registry', 'conveyance', 'legality'] as const;

export const OWNER_ISSUANCE_KEYS = {
  title: `${K}title`,
  lead: `${K}lead`,
  loadFailed: `${K}loadFailed`,
  readOnly: `${K}readOnly`,
  noRequest: `${K}noRequest`,
  findProfessional: `${K}findProfessional`,
  bidsCount: `${K}bidsCount`,
  inviteMore: `${K}inviteMore`,
  limitReached: `${K}limitReached`,
  closed: `${K}closed`,
  requestAgain: `${K}requestAgain`,
  awaitingQuote: `${K}awaitingQuote`,
  bidClosed: `${K}bidClosed`,
  award: `${K}award`,
  cancelRequest: `${K}cancelRequest`,
  saving: `${K}saving`,
  professionalUnavailable: `${K}professionalUnavailable`,
  viewProfile: `${K}viewProfile`,
  timeline: `${K}timeline`,
  awardedBadge: `${K}awardedBadge`,
  invited: `${K}done.invited`,
  awarded: `${K}done.awarded`,
  cancelled: `${K}done.cancelled`,
} as const;

/** Οι δύο επιβεβαιώσεις — η επιλογή **δεσμεύει** (κλείνουν οι άλλες), η ακύρωση κλείνει όλες. */
export const OWNER_ISSUANCE_CONFIRM_KEYS = {
  awardTitle: `${K}confirm.awardTitle`,
  awardDescription: `${K}confirm.awardDescription`,
  awardConfirm: `${K}confirm.awardConfirm`,
  cancelTitle: `${K}confirm.cancelTitle`,
  cancelDescription: `${K}confirm.cancelDescription`,
  cancelConfirm: `${K}confirm.cancelConfirm`,
  keep: `${K}confirm.keep`,
} as const;

/**
 * **Τα στάδια στη φωνή του ιδιώτη** — ίδια μηχανή καταστάσεων με το γραφείο, **άλλος ομιλητής** (Procore «Ball in
 * Court»: η ίδια κατάσταση γράφεται ανά ρόλο). Οι λέξεις του γραφείου (`ISSUANCE_STAGE_KEYS`) μιλούν σε τρίτο πρόσωπο
 * για «τον ιδιοκτήτη» και ζητούν πράξεις που ο ιδιώτης **δεν έχει** («ζητήστε προσφορά» στο `proposed`) — στον ίδιο τον
 * ιδιοκτήτη θα έλεγαν «αναμένει έγκριση του ιδιοκτήτη». Ολικός χάρτης: νέο στάδιο δεν μεταγλωττίζεται χωρίς λέξη.
 */
export const OWNER_STAGE_KEYS: Readonly<Record<IssuanceStage, string>> = {
  proposed: `${K}stage.proposed`,
  ownerApproved: `${K}stage.ownerApproved`,
  ownerRejected: `${K}stage.ownerRejected`,
  sent: `${K}stage.sent`,
  quoted: `${K}stage.quoted`,
  accepted: `${K}stage.accepted`,
  declined: `${K}stage.declined`,
  cancelled: `${K}stage.cancelled`,
};

/** Δ3 — η μπάλα από την πλευρά του ιδιώτη (`ownerBallOf`: «Σειρά σου» μόνο όπου υπάρχει πράξη). */
export const OWNER_BALL_KEYS: Readonly<Record<OwnerBallParty, string>> = {
  owner: `${K}ball.owner`,
  professional: `${K}ball.professional`,
};

export const BID_TIMELINE_KEYS: Readonly<Record<BidTimelineKind, string>> = {
  requested: `${K}timelineEntry.requested`,
  sent: `${K}timelineEntry.sent`,
  quoted: `${K}timelineEntry.quoted`,
  revised: `${K}timelineEntry.revised`,
  approved: `${K}timelineEntry.approved`,
  rejected: `${K}timelineEntry.rejected`,
  accepted: `${K}timelineEntry.accepted`,
  declined: `${K}timelineEntry.declined`,
  cancelled: `${K}timelineEntry.cancelled`,
  'not-awarded': `${K}timelineEntry.notAwarded`,
};

/** Άρνηση του διακομιστή → μήνυμα· **κανένα** `default` — νέα άρνηση δεν μεταγλωττίζεται χωρίς λέξη. */
export const OWNER_ISSUANCE_ERROR_KEYS: Readonly<Record<IssuanceRequestServiceRefusal | 'failed', string>> = {
  failed: `${K}error.failed`,
  absent: `${K}error.absent`,
  retired: `${K}error.retired`,
  'not-assignable': `${K}error.notAssignable`,
  'office-ledger': `${K}error.officeLedger`,
  unavailable: `${K}error.unavailable`,
  'professional-unavailable': `${K}error.professionalUnavailable`,
  unqualified: `${K}error.unqualified`,
  stale: `${K}error.stale`,
  'bid-limit': `${K}error.bidLimit`,
  'already-awarded': `${K}error.alreadyAwarded`,
  'unknown-bid': `${K}error.unknownBid`,
  'request-closed': `${K}error.requestClosed`,
  'transition-refused': `${K}error.transitionRefused`,
  'actor-refused': `${K}error.actorRefused`,
  'terms-refused': `${K}error.termsRefused`,
  'receipt-mismatch': `${K}error.receiptMismatch`,
};
