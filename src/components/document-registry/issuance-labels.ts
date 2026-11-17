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
import type { IssuanceDeliveryOutcome } from '@/lib/document-validity/issuance-delivery';
import type { IssuanceSpaceStatus } from '@/lib/document-validity/issuance-space';

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
  // §39.8 — η δήλωση του ίδιου του επαγγελματία (μπήκε στον χώρο) · του γραφείου μόνο όταν διαφέρει.
  credentialBySelf: `${K}issuance.credentialBySelf`,
  credentialOfficeDiffers: `${K}issuance.credentialOfficeDiffers`,
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
  quoted: `${K}issuance.stage.quoted`,
  accepted: `${K}issuance.stage.accepted`,
  declined: `${K}issuance.stage.declined`,
  cancelled: `${K}issuance.stage.cancelled`,
};

/**
 * ADR-915 §45 Φ1 — **η ενέργεια της γραμμής** όταν η μπάλα είναι στο **γραφείο**: κουμπί που ανοίγει το πάνελ στο βήμα
 * του. `null` = η μπάλα είναι σε τρίτον (ή το στάδιο έκλεισε) ⇒ το στάδιο ως κείμενο. Ολικός χάρτης: νέο στάδιο δεν
 * μεταγλωττίζεται χωρίς απόφαση· η αντιστοιχία `≠ null ⇔ ballInCourtOf(stage) === 'office'` κλειδώνεται με test.
 */
export const ISSUANCE_ROW_ACTION_KEYS: Readonly<Record<IssuanceStage, string | null>> = {
  proposed: `${K}issuance.rowAction.proposed`,
  ownerApproved: `${K}issuance.rowAction.ownerApproved`,
  declined: `${K}issuance.rowAction.declined`,
  ownerRejected: null,
  sent: null,
  quoted: null,
  accepted: null,
  cancelled: null,
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

/** ADR-915 §40.7 Φ3 — η καταλληλότητα του επαγγελματία (τάξη απέναντι στο ακίνητο) και ποιος λέει την τάξη. */
export const INSPECTOR_FIT_KEYS = {
  covers: `${K}issuance.fit.covers`,
  exceeds: `${K}issuance.fit.exceeds`,
  areaUnknown: `${K}issuance.fit.areaUnknown`,
  notGraded: `${K}issuance.fit.notGraded`,
  gradeUnknown: `${K}issuance.fit.gradeUnknown`,
  gradeOnly: `${K}issuance.fit.gradeOnly`,
  sourceRegistry: `${K}issuance.fit.sourceRegistry`,
  sourceDeclared: `${K}issuance.fit.sourceDeclared`,
  recheck: `${K}issuance.fit.recheck`,
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

/** §42 — η προσφορά στην κάρτα του γραφείου: ιστορικό · καταγραφή · παραστατικό. */
export const QUOTE_KEYS = {
  line: `${K}issuance.quote.line`,
  revisedLine: `${K}issuance.quote.revisedLine`,
  receiptLine: `${K}issuance.quote.receiptLine`,
  title: `${K}issuance.quote.title`,
  description: `${K}issuance.quote.description`,
  noteLabel: `${K}issuance.quote.noteLabel`,
  submit: `${K}issuance.quote.submit`,
  recordQuote: `${K}issuance.action.recordQuote`,
  recordRevision: `${K}issuance.action.recordRevision`,
  noQuote: `${K}issuance.action.noQuote`,
  withdrawn: `${K}issuance.action.withdrawn`,
  recordReceipt: `${K}issuance.action.recordReceipt`,
} as const;


export const RECEIPT_KEYS = {
  title: `${K}issuance.receipt.title`,
  description: `${K}issuance.receipt.description`,
  markLabel: `${K}issuance.receipt.markLabel`,
  issuedOnLabel: `${K}issuance.receipt.issuedOnLabel`,
  submit: `${K}issuance.receipt.submit`,
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
  /** ADR-943 Φ5γ (Ζ-4) — τι γίνεται με τα κρατημένα χρήματα, **πριν** την επιβεβαίωση. */
  moneySettle: `${K}issuance.cancelDialog.moneySettle`,
  moneyResolved: `${K}issuance.cancelDialog.moneyResolved`,
  moneyFrozen: `${K}issuance.cancelDialog.moneyFrozen`,
} as const;

/**
 * Άρνηση του διακομιστή → μήνυμα (`ISSUANCE_REFUSAL_STATUS` του route). Άγνωστος κωδικός / δίκτυο ⇒ `failed`.
 * ⚠️ Οι κωδικοί είναι ίδιοι με του route — η ισότητα κλειδώνεται με άγκυρα στο test.
 */
export const ISSUANCE_REFUSAL_CODES = [
  'NOT_FOUND', 'ASSIGNMENTS_UNAVAILABLE', 'CONTACT_UNAVAILABLE', 'UNQUALIFIED',
  'LEAD_UNDESIGNATED', 'LEAD_CHANGED', 'STALE', 'TRANSITION_REFUSED', 'ACTOR_REFUSED', 'TERMS_REFUSED', 'RECEIPT_MISMATCH',
  'SETTLEMENT_BUSY',
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
  TERMS_REFUSED: `${K}issuance.error.termsRefused`,
  RECEIPT_MISMATCH: `${K}issuance.error.receiptMismatch`,
  SETTLEMENT_BUSY: `${K}issuance.error.settlementBusy`,
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
  // §31 — αυτόματες υπενθυμίσεις (72 ώρες μετά · την παραμονή της λήξης).
  remindersLabel: `${K}issuance.send.remindersLabel`,
  remindersHint: `${K}issuance.send.remindersHint`,
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
  reminderSent: `${K}issuance.history.reminderSent`,
  reminderNext: `${K}issuance.history.reminderNext`,
} as const;

/**
 * §30 — **τι λέει το ιστορικό για την παράδοση στον παραλήπτη**, ανά τιμή του κλειστού λεξιλογίου. `null` = τίποτα πέρα
 * από το «στάλθηκε» (το `accepted` — «μπήκε σε ουρά» — δεν έχει γραμμή: δεν υπόσχεται τίποτα). Χάρτης «τιμή → κλειδί», ώστε ο
 * γεννήτορας του route slice να τον λύνει στατικά.
 */
export const DELIVERY_HISTORY_KEYS: Readonly<Record<Exclude<IssuanceDeliveryOutcome, 'accepted'>, string>> = {
  delivered: `${K}issuance.history.delivered`,
  failed: `${K}issuance.history.notDelivered`,
  unaddressable: `${K}issuance.history.notDelivered`,
  bounced: `${K}issuance.history.bounced`,
  complained: `${K}issuance.history.complained`,
};

/** Ζητά ενέργεια από τον άνθρωπο; — η λέξη το λέει, το χρώμα απλώς το τονίζει. */
export const DELIVERY_ALARM: Readonly<Record<IssuanceDeliveryOutcome, boolean>> = {
  accepted: false, delivered: false, failed: true, unaddressable: true, bounced: true, complained: true,
};

/** Έφτασε το μήνυμα σε άνθρωπο; — για το «ενημερώθηκαν Ν συνιδιοκτήτες». Το `complained` **σημαίνει** ότι το έλαβε. */
export const DELIVERY_REACHED: Readonly<Record<IssuanceDeliveryOutcome, boolean>> = {
  accepted: true, delivered: true, complained: true, failed: false, unaddressable: false, bounced: false,
};

/**
 * §39 — **ο χώρος της ανάθεσης** στην κάρτα του γραφείου: η κατάσταση (`IssuanceSpaceStatus`) και το «Νέος σύνδεσμος
 * εισόδου». Ολικός πάνω στις καταστάσεις — νέα κατάσταση δεν μεταγλωττίζεται χωρίς λέξη.
 */
export const ISSUANCE_SPACE_STATUS_KEYS: Readonly<Record<IssuanceSpaceStatus['kind'], string>> = {
  none: `${K}issuance.space.none`,
  invited: `${K}issuance.space.invited`,
  expired: `${K}issuance.space.expired`,
  declined: `${K}issuance.space.declined`,
  entered: `${K}issuance.space.entered`,
};

export const ISSUANCE_SPACE_KEYS = {
  label: `${K}issuance.space.label`,
  opened: `${K}issuance.space.opened`,
  notOpened: `${K}issuance.space.notOpened`,
  send: `${K}issuance.space.send`,
  resend: `${K}issuance.space.resend`,
  sending: `${K}issuance.space.sending`,
  sent: `${K}issuance.space.sent`,
  sentUndelivered: `${K}issuance.space.sentUndelivered`,
} as const;

/** ADR-943 Φ5β2 — «Αίτημα πληρωμής / Νέος σύνδεσμος» της προκαταβολής στην κάρτα ανάθεσης. */
export const ISSUANCE_ADVANCE_LINK_KEYS = {
  label: `${K}issuance.advance.ownerLink.label`,
  requestPayment: `${K}issuance.advance.ownerLink.requestPayment`,
  resend: `${K}issuance.advance.ownerLink.resend`,
  confirmTitle: `${K}issuance.advance.ownerLink.confirmTitle`,
  confirmBody: `${K}issuance.advance.ownerLink.confirmBody`,
  cancel: `${K}issuance.advance.ownerLink.cancel`,
  send: `${K}issuance.advance.ownerLink.send`,
  sending: `${K}issuance.advance.ownerLink.sending`,
  sent: `${K}issuance.advance.ownerLink.sent`,
  sentUndelivered: `${K}issuance.advance.ownerLink.sentUndelivered`,
} as const;

/** ADR-943 Φ5γ (Θ-5) — η απόφαση του γραφείου στη διαφορά της προκαταβολής. */
export const ISSUANCE_ADVANCE_DISPUTE_KEYS = {
  trigger: `${K}issuance.advance.dispute.trigger`,
  title: `${K}issuance.advance.dispute.title`,
  description: `${K}issuance.advance.dispute.description`,
  objection: `${K}issuance.advance.dispute.objection`,
  held: `${K}issuance.advance.dispute.held`,
  legend: `${K}issuance.advance.dispute.legend`,
  releaseAll: `${K}issuance.advance.dispute.releaseAll`,
  refundAll: `${K}issuance.advance.dispute.refundAll`,
  split: `${K}issuance.advance.dispute.split`,
  splitLabel: `${K}issuance.advance.dispute.splitLabel`,
  splitHint: `${K}issuance.advance.dispute.splitHint`,
  summary: `${K}issuance.advance.dispute.summary`,
  reasonLabel: `${K}issuance.advance.dispute.reasonLabel`,
  submit: `${K}issuance.advance.dispute.submit`,
  decided: `${K}issuance.advance.dispute.decided`,
} as const;

/** Οι αρνήσεις της πόρτας (`ADVANCE_LINK_REFUSAL_STATUS`) — ο κωδικός είναι και το κλειδί· άγνωστος ⇒ `generic`. */
export const ISSUANCE_ADVANCE_LINK_REFUSAL_KEYS: Readonly<Record<string, string>> = {
  NOT_FOUND: `${K}issuance.advance.ownerLink.refusals.NOT_FOUND`,
  NOT_ACCEPTED: `${K}issuance.advance.ownerLink.refusals.NOT_ACCEPTED`,
  NOTHING_TO_DO: `${K}issuance.advance.ownerLink.refusals.NOTHING_TO_DO`,
  NO_ADVANCE: `${K}issuance.advance.ownerLink.refusals.NO_ADVANCE`,
  SETTLED: `${K}issuance.advance.ownerLink.refusals.SETTLED`,
  NO_EMAIL: `${K}issuance.advance.ownerLink.refusals.NO_EMAIL`,
  UNAVAILABLE: `${K}issuance.advance.ownerLink.refusals.UNAVAILABLE`,
  generic: `${K}issuance.advance.ownerLink.refusals.generic`,
};

/** Οι αρνήσεις της πόρτας (`SPACE_INVITE_REFUSAL_STATUS`) — ο κωδικός είναι και το κλειδί· άγνωστος ⇒ `generic`. */
export const ISSUANCE_SPACE_REFUSAL_KEYS: Readonly<Record<string, string>> = {
  NOT_FOUND: `${K}issuance.space.refusals.NOT_FOUND`,
  NOT_ACCEPTED: `${K}issuance.space.refusals.NOT_ACCEPTED`,
  ALREADY_ENTERED: `${K}issuance.space.refusals.ALREADY_ENTERED`,
  NO_PROJECT: `${K}issuance.space.refusals.NO_PROJECT`,
  NO_AUTHORITY: `${K}issuance.space.refusals.NO_AUTHORITY`,
  NO_EMAIL: `${K}issuance.space.refusals.NO_EMAIL`,
  SPACE_UNKNOWN: `${K}issuance.space.refusals.SPACE_UNKNOWN`,
  generic: `${K}issuance.space.refusals.generic`,
};
