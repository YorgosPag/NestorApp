/**
 * @fileoverview ADR-915 §27 — **οι λέξεις της ανάθεσης έκδοσης**: κάθε χάρτης δεμένος στο κλειστό λεξιλόγιο του πυρήνα
 *   (`issuance-assignment.ts`) — νέο στάδιο, κανάλι ή άρνηση **δεν μεταγλωττίζεται** χωρίς λέξη (CHECK 3.73).
 * @related document-registry-labels.ts (οι λέξεις του μητρώου — χωριστό αρχείο ώστε να μείνει κάτω από το όριο N.7.1)
 * @module components/document-registry/issuance-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά (CHECK 3.34).
 */

import type {
  BallInCourtParty,
  InstructionChannel,
  IssuanceStage,
} from '@/lib/document-validity/issuance-assignment';

const K = 'document-registry:';

export const ISSUANCE_KEYS = {
  heading: `${K}issuance.heading`,
  assign: `${K}issuance.assign`,
  assignHint: `${K}issuance.assignHint`,
  proposeOther: `${K}issuance.proposeOther`,
  unavailable: `${K}issuance.unavailable`,
  professional: `${K}issuance.professional`,
  professionalUnavailable: `${K}issuance.professionalUnavailable`,
  credential: `${K}issuance.credential`,
  credentialWithNumber: `${K}issuance.credentialWithNumber`,
  verifyRegistry: `${K}issuance.verifyRegistry`,
  ballInCourt: `${K}issuance.ballInCourt`,
  proposedOn: `${K}issuance.proposedOn`,
  decided: `${K}issuance.decided`,
  noticed: `${K}issuance.noticed`,
  lastFulfilled: `${K}issuance.lastFulfilled`,
  lastClosed: `${K}issuance.lastClosed`,
  saving: `${K}issuance.saving`,
  recordDecision: `${K}issuance.action.recordDecision`,
  markNotified: `${K}issuance.action.markNotified`,
  accepted: `${K}issuance.action.accepted`,
  declined: `${K}issuance.action.declined`,
  cancel: `${K}issuance.action.cancel`,
} as const;

export const ISSUANCE_STAGE_KEYS: Readonly<Record<IssuanceStage, string>> = {
  proposed: `${K}issuance.stage.proposed`,
  ownerApproved: `${K}issuance.stage.ownerApproved`,
  ownerRejected: `${K}issuance.stage.ownerRejected`,
  sent: `${K}issuance.stage.sent`,
  accepted: `${K}issuance.stage.accepted`,
  declined: `${K}issuance.stage.declined`,
  cancelled: `${K}issuance.stage.cancelled`,
};

export const BALL_IN_COURT_KEYS: Readonly<Record<BallInCourtParty, string>> = {
  owner: `${K}issuance.party.owner`,
  office: `${K}issuance.party.office`,
  professional: `${K}issuance.party.professional`,
};

/** Ένας χάρτης για τα δύο κανάλια: τα κανάλια ενημέρωσης είναι υποσύνολο των καναλιών εντολής. */
export const CHANNEL_KEYS: Readonly<Record<InstructionChannel, string>> = {
  'in-person': `${K}issuance.channel.in-person`,
  phone: `${K}issuance.channel.phone`,
  email: `${K}issuance.channel.email`,
  written: `${K}issuance.channel.written`,
};

export const PROPOSE_KEYS = {
  title: `${K}issuance.propose.title`,
  description: `${K}issuance.propose.description`,
  knownLegend: `${K}issuance.propose.knownLegend`,
  noKnown: `${K}issuance.propose.noKnown`,
  sameProperty: `${K}issuance.propose.sameProperty`,
  previously: `${K}issuance.propose.previously`,
  otherContact: `${K}issuance.propose.otherContact`,
  searchPlaceholder: `${K}issuance.propose.searchPlaceholder`,
  qualificationLabel: `${K}issuance.propose.qualificationLabel`,
  qualificationPlaceholder: `${K}issuance.propose.qualificationPlaceholder`,
  registryNumberLabel: `${K}issuance.propose.registryNumberLabel`,
  declared: `${K}issuance.propose.declared`,
  submit: `${K}issuance.propose.submit`,
  cancel: `${K}issuance.propose.cancel`,
} as const;

export const DECISION_KEYS = {
  title: `${K}issuance.decision.title`,
  description: `${K}issuance.decision.description`,
  needsLead: `${K}issuance.decision.needsLead`,
  outcomeLegend: `${K}issuance.decision.outcomeLegend`,
  approved: `${K}issuance.decision.approved`,
  rejected: `${K}issuance.decision.rejected`,
  channelLegend: `${K}issuance.decision.channelLegend`,
  noteLabel: `${K}issuance.decision.noteLabel`,
  submit: `${K}issuance.decision.submit`,
} as const;

export const NOTICE_KEYS = {
  title: `${K}issuance.notice.title`,
  description: `${K}issuance.notice.description`,
  channelLegend: `${K}issuance.notice.channelLegend`,
  submit: `${K}issuance.notice.submit`,
} as const;

export const CANCEL_KEYS = {
  title: `${K}issuance.cancelDialog.title`,
  description: `${K}issuance.cancelDialog.description`,
  confirm: `${K}issuance.cancelDialog.confirm`,
  keep: `${K}issuance.cancelDialog.keep`,
} as const;

/**
 * Άρνηση του διακομιστή → μήνυμα (`ISSUANCE_REFUSAL_STATUS` του route). Άγνωστος κωδικός / δίκτυο ⇒ `failed`.
 * ⚠️ Οι κωδικοί είναι ίδιοι με του route — η ισότητα κλειδώνεται με άγκυρα στο test.
 */
export const ISSUANCE_REFUSAL_CODES = [
  'NOT_FOUND', 'ASSIGNMENTS_UNAVAILABLE', 'CONTACT_UNAVAILABLE', 'UNQUALIFIED',
  'LEAD_UNDESIGNATED', 'LEAD_CHANGED', 'STALE', 'TRANSITION_REFUSED', 'ACTOR_REFUSED',
] as const;
export type IssuanceRefusalCode = (typeof ISSUANCE_REFUSAL_CODES)[number];

export const ISSUANCE_ERROR_KEYS: Readonly<Record<IssuanceRefusalCode | 'failed', string>> = {
  failed: `${K}issuance.error.failed`,
  NOT_FOUND: `${K}issuance.error.notFound`,
  ASSIGNMENTS_UNAVAILABLE: `${K}issuance.error.unavailable`,
  CONTACT_UNAVAILABLE: `${K}issuance.error.contactUnavailable`,
  UNQUALIFIED: `${K}issuance.error.unqualified`,
  LEAD_UNDESIGNATED: `${K}issuance.error.leadUndesignated`,
  LEAD_CHANGED: `${K}issuance.error.leadChanged`,
  STALE: `${K}issuance.error.stale`,
  TRANSITION_REFUSED: `${K}issuance.error.transitionRefused`,
  ACTOR_REFUSED: `${K}issuance.error.actorRefused`,
};

/**
 * §28 — οι αρνήσεις της **αποστολής** (`messages/issuance-send-refusals.ts`): οι κοινοί κωδικοί + τρεις δικοί της.
 * ⚠️ Χωριστός πίνακας επίτηδες: τον καλεί **μόνο** η φόρμα αποστολής (`next/dynamic`), άρα οι λέξεις του δεν βαραίνουν
 *    το πρώτο καρέ της σελίδας λήξεων (CHECK 3.34 — ο τεμαχιστής μετρά ανά κλήση `t(ΠΙΝΑΚΑΣ[…])`).
 */
export const ISSUANCE_SEND_REFUSAL_CODES = [...ISSUANCE_REFUSAL_CODES, 'NO_EMAIL', 'CO_OWNER_UNKNOWN', 'LINKS_UNAVAILABLE'] as const;
export type IssuanceSendRefusalCode = (typeof ISSUANCE_SEND_REFUSAL_CODES)[number];

export const SEND_ERROR_KEYS: Readonly<Record<IssuanceSendRefusalCode | 'failed', string>> = {
  ...ISSUANCE_ERROR_KEYS,
  NO_EMAIL: `${K}issuance.error.noEmail`,
  CO_OWNER_UNKNOWN: `${K}issuance.error.coOwnerUnknown`,
  LINKS_UNAVAILABLE: `${K}issuance.error.linksUnavailable`,
};

/** §28 — πρόχειρο · προεπισκόπηση · αποστολή με σύνδεσμο. */
export const SEND_KEYS = {
  ownerTrigger: `${K}issuance.send.ownerTrigger`,
  ownerResend: `${K}issuance.send.ownerResend`,
  professionalTrigger: `${K}issuance.send.professionalTrigger`,
  professionalResend: `${K}issuance.send.professionalResend`,
  ownerTitle: `${K}issuance.send.ownerTitle`,
  professionalTitle: `${K}issuance.send.professionalTitle`,
  ownerDescription: `${K}issuance.send.ownerDescription`,
  professionalDescription: `${K}issuance.send.professionalDescription`,
  noteLabel: `${K}issuance.send.noteLabel`,
  coOwnersLegend: `${K}issuance.send.coOwnersLegend`,
  noEmail: `${K}issuance.send.noEmail`,
  previewHeading: `${K}issuance.send.previewHeading`,
  to: `${K}issuance.send.to`,
  coOwnerPreview: `${K}issuance.send.coOwnerPreview`,
  loading: `${K}issuance.send.loading`,
  never: `${K}issuance.send.never`,
  submit: `${K}issuance.send.submit`,
  sending: `${K}issuance.send.sending`,
  sent: `${K}issuance.send.sent`,
  notDelivered: `${K}issuance.send.notDelivered`,
  // §29 — κωδικός πρόσβασης σε δεύτερο κανάλι (το γραφείο τον λέει τηλεφωνικά).
  accessCodeLabel: `${K}issuance.send.accessCodeLabel`,
  accessCodeHint: `${K}issuance.send.accessCodeHint`,
  codeHeading: `${K}issuance.send.codeHeading`,
  codeBody: `${K}issuance.send.codeBody`,
  codeCopy: `${K}issuance.send.codeCopy`,
  codeCopied: `${K}issuance.send.codeCopied`,
  codeDone: `${K}issuance.send.codeDone`,
} as const;

/** §28 — οι γραμμές ιστορικού των μηνυμάτων με σύνδεσμο και των απαντήσεων. */
export const LINK_HISTORY_KEYS = {
  requestedApproval: `${K}issuance.history.requestedApproval`,
  informed: `${K}issuance.history.informed`,
  notDelivered: `${K}issuance.history.notDelivered`,
  decidedByLink: `${K}issuance.history.decidedByLink`,
  noticedByLink: `${K}issuance.history.noticedByLink`,
  acceptedByLink: `${K}issuance.history.acceptedByLink`,
  declinedByLink: `${K}issuance.history.declinedByLink`,
  responseNote: `${K}issuance.history.responseNote`,
  withAccessCode: `${K}issuance.history.withAccessCode`,
  verifiedByCode: `${K}issuance.history.verifiedByCode`,
} as const;
