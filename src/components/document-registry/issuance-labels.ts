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
  'LEAD_UNDESIGNATED', 'LEAD_CHANGED', 'STALE', 'TRANSITION_REFUSED',
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
};
