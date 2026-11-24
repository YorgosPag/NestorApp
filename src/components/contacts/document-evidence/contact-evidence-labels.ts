/**
 * @fileoverview Τα κλειδιά i18n του πίνακα «Το έγγραφο λέει / Η επαφή λέει» (ADR-950 §4.4) — ο ΕΝΑΣ χάρτης.
 * @module components/contacts/document-evidence/contact-evidence-labels
 *
 * `Record` πάνω στις ρίζες των λεξιλογίων ⇒ νέα κρίση, αιτία ή γραμμή **χωρίς** ετικέτα = σφάλμα μεταγλώττισης,
 * όχι ωμό κλειδί στην οθόνη (ίδιο σχήμα με το `contact-company-registry-labels`). Πλήρη literal κλειδιά — οι πύλες
 * i18n (3.8 · 3.13) τα διαβάζουν **στατικά**.
 */

import type {
  EvidenceAddressField,
  EvidenceDismissReason,
  EvidenceFieldKey,
  EvidenceIssuerField,
  EvidenceRowKey,
} from '@/config/contact-document-evidence';
import type { UngroundedReason } from '@/lib/contacts/contact-evidence-grounding';
import type { EvidenceFollowUp } from '@/lib/contacts/contact-evidence-acceptance';
import type { EvidenceComparisonState } from '@/lib/contacts/contact-evidence-comparison';

export const CONTACT_EVIDENCE_KEYS = {
  badge: 'contacts-form:documentEvidence.badge',
  badgeMatched: 'contacts-form:documentEvidence.badgeMatched',
  title: 'contacts-form:documentEvidence.title',
  subtitle: 'contacts-form:documentEvidence.subtitle',
  empty: 'contacts-form:documentEvidence.empty',
  dismissed: 'contacts-form:documentEvidence.decision.dismissed',
  reopened: 'contacts-form:documentEvidence.decision.reopened',
  accept: 'contacts-form:documentEvidence.actions.accept',
  add: 'contacts-form:documentEvidence.actions.add',
  proposeAddress: 'contacts-form:documentEvidence.actions.proposeAddress',
  dismiss: 'contacts-form:documentEvidence.actions.dismiss',
  dismissReason: 'contacts-form:documentEvidence.actions.dismissReason',
  restore: 'contacts-form:documentEvidence.actions.restore',
  editToAccept: 'contacts-form:documentEvidence.actions.editToAccept',
  /** ADR-950 §9 — «Καταχώριση» από την προβολή (κενό πεδίο, ελεγμένη τιμή, ένα πάτημα). */
  register: 'contacts-form:documentEvidence.actions.register',
  compareOnly: 'contacts-form:documentEvidence.actions.compareOnly',
  reread: 'contacts-form:documentEvidence.actions.reread',
  dismissFailed: 'contacts-form:documentEvidence.errors.dismissFailed',
  restoreFailed: 'contacts-form:documentEvidence.errors.restoreFailed',
  /** ADR-950 §12 — το ΑΦΜ το έχει ήδη άλλη επαφή: καμία καταχώριση με ένα πάτημα. */
  vatTaken: 'contacts-form:documentEvidence.errors.vatTaken',
} as const;

export const CONTACT_EVIDENCE_COLUMN_KEYS = {
  field: 'contacts-form:documentEvidence.columns.field',
  document: 'contacts-form:documentEvidence.columns.document',
  contact: 'contacts-form:documentEvidence.columns.contact',
  state: 'contacts-form:documentEvidence.columns.state',
  action: 'contacts-form:documentEvidence.columns.action',
} as const;

export const CONTACT_EVIDENCE_ROW_KEYS: Readonly<Record<EvidenceRowKey, string>> = {
  fullName: 'contacts-form:documentEvidence.fields.fullName',
  lastName: 'contacts-form:documentEvidence.fields.lastName',
  firstName: 'contacts-form:documentEvidence.fields.firstName',
  fatherName: 'contacts-form:documentEvidence.fields.fatherName',
  birthDate: 'contacts-form:documentEvidence.fields.birthDate',
  documentNumber: 'contacts-form:documentEvidence.fields.documentNumber',
  documentIssuer: 'contacts-form:documentEvidence.fields.documentIssuer',
  vatNumber: 'contacts-form:documentEvidence.fields.vatNumber',
  taxOffice: 'contacts-form:documentEvidence.fields.taxOffice',
  address: 'contacts-form:documentEvidence.fields.address',
  phone: 'contacts-form:documentEvidence.fields.phone',
  teeRegistryNumber: 'contacts-form:documentEvidence.fields.teeRegistryNumber',
  oeeNumber: 'contacts-form:documentEvidence.fields.oeeNumber',
  barAssociationNumber: 'contacts-form:documentEvidence.fields.barAssociationNumber',
  notaryRegistryNumber: 'contacts-form:documentEvidence.fields.notaryRegistryNumber',
};

/** Η γραμμή `fullName` σε εταιρεία/υπηρεσία είναι **επωνυμία**, όχι ονοματεπώνυμο. */
export const CONTACT_EVIDENCE_ORGANISATION_NAME_KEY = 'contacts-form:documentEvidence.fields.organisationName';

export const CONTACT_EVIDENCE_STATE_KEYS: Readonly<Record<EvidenceComparisonState, string>> = {
  match: 'contacts-form:documentEvidence.state.match',
  partial: 'contacts-form:documentEvidence.state.partial',
  missing: 'contacts-form:documentEvidence.state.missing',
  differs: 'contacts-form:documentEvidence.state.differs',
  'not-comparable': 'contacts-form:documentEvidence.state.notComparable',
};

const CONTACT_EVIDENCE_UNGROUNDED_KEYS: Readonly<Record<UngroundedReason, string>> = {
  absent: 'contacts-form:documentEvidence.ungrounded.absent',
  'low-confidence': 'contacts-form:documentEvidence.ungrounded.lowConfidence',
  'failed-check': 'contacts-form:documentEvidence.ungrounded.failedCheck',
  disputed: 'contacts-form:documentEvidence.ungrounded.disputed',
  unverified: 'contacts-form:documentEvidence.ungrounded.unverified',
  'issuer-missing': 'contacts-form:documentEvidence.ungrounded.issuerMissing',
  'map-unavailable': 'contacts-form:documentEvidence.ungrounded.mapUnavailable',
};

/**
 * ADR-950 §8.12 — ΑΦΜ που **δεν περνά το ψηφίο ελέγχου**: στη σφραγίδα σχεδόν πάντα τον καλύπτει η υπογραφή (ζωντανός
 * έλεγχος 2026-11-24: «0408 719 944» · «0408 7944»). Το σκέτο «Δυσανάγνωστο» δεν έλεγε στον άνθρωπο τι να κάνει.
 */
const VAT_FAILED_CHECK_KEY = 'contacts-form:documentEvidence.ungrounded.failedCheckVat';

/** Η ετικέτα του «γιατί δεν συγκρίνεται» — ανά αιτία, με την ειδική περίπτωση του ΑΦΜ. */
export function ungroundedLabelKey(row: EvidenceRowKey, reason: UngroundedReason): string {
  return row === 'vatNumber' && reason === 'failed-check' ? VAT_FAILED_CHECK_KEY : CONTACT_EVIDENCE_UNGROUNDED_KEYS[reason];
}

/** ADR-950 §8 — τα τεκμήρια διακομιστή στην οθόνη (δεύτερη ανάγνωση · διορθωμένη οδός · τυπωμένη μορφή). */
export const CONTACT_EVIDENCE_CORROBORATION_KEYS = {
  alternate: 'contacts-form:documentEvidence.corroboration.alternate',
  alternateUnreadable: 'contacts-form:documentEvidence.corroboration.alternateUnreadable',
  correctedStreet: 'contacts-form:documentEvidence.corroboration.correctedStreet',
  /** «Τυπωμένο: …» κάτω από την κανονική μορφή — οδός «Μήπως…» και τηλέφωνο (ADR-950 §8.12). */
  printed: 'contacts-form:documentEvidence.corroboration.printed',
} as const;

/** ADR-950 §8.6 — «Συμπλήρωση κενών». */
export const CONTACT_EVIDENCE_FILL_KEYS = {
  button: 'contacts-form:documentEvidence.fill.button',
  title: 'contacts-form:documentEvidence.fill.title',
  description: 'contacts-form:documentEvidence.fill.description',
  /** Από την προβολή: η εφαρμογή καταχωρίζει αμέσως (ADR-950 §9). */
  descriptionImmediate: 'contacts-form:documentEvidence.fill.descriptionImmediate',
  address: 'contacts-form:documentEvidence.fill.address',
  apply: 'contacts-form:documentEvidence.fill.apply',
  cancel: 'contacts-form:documentEvidence.fill.cancel',
  editToFill: 'contacts-form:documentEvidence.fill.editToFill',
} as const;

/** ADR-950 §10 — «Διόρθωση ανάγνωσης»: ο άνθρωπος διαβάζει ο ίδιος τη γραμμή. */
export const CONTACT_EVIDENCE_CORRECTION_KEYS = {
  action: 'contacts-form:documentEvidence.correction.action',
  title: 'contacts-form:documentEvidence.correction.title',
  description: 'contacts-form:documentEvidence.correction.description',
  descriptionAddress: 'contacts-form:documentEvidence.correction.descriptionAddress',
  firstReading: 'contacts-form:documentEvidence.correction.firstReading',
  secondReading: 'contacts-form:documentEvidence.correction.secondReading',
  invalid: 'contacts-form:documentEvidence.correction.invalid',
  save: 'contacts-form:documentEvidence.correction.save',
  cancel: 'contacts-form:documentEvidence.correction.cancel',
  clear: 'contacts-form:documentEvidence.correction.clear',
  byHuman: 'contacts-form:documentEvidence.correction.byHuman',
  machineRead: 'contacts-form:documentEvidence.correction.machineRead',
  machineAbsent: 'contacts-form:documentEvidence.correction.machineAbsent',
  stale: 'contacts-form:documentEvidence.correction.stale',
  addressPending: 'contacts-form:documentEvidence.correction.addressPending',
  /** ADR-950 §11 — η κρίση που **θα** βγει μετά την αποθήκευση, και η πράξη που ακολουθεί με το ίδιο πάτημα. */
  outcome: 'contacts-form:documentEvidence.correction.outcome',
  contactSays: 'contacts-form:documentEvidence.correction.contactSays',
  saveOnly: 'contacts-form:documentEvidence.correction.saveOnly',
  saveFailed: 'contacts-form:documentEvidence.errors.correctionFailed',
  clearFailed: 'contacts-form:documentEvidence.errors.correctionClearFailed',
} as const;

/** Τα πεδία που **δεν** είναι δική τους γραμμή (μέρη διεύθυνσης · εκδότες μητρώου) — ετικέτα μόνο στον διάλογο διόρθωσης. */
const CORRECTION_PART_KEYS: Readonly<Record<EvidenceAddressField | EvidenceIssuerField, string>> = {
  addressStreet: 'contacts-form:documentEvidence.correction.fields.addressStreet',
  addressNumber: 'contacts-form:documentEvidence.correction.fields.addressNumber',
  addressPostalCode: 'contacts-form:documentEvidence.correction.fields.addressPostalCode',
  addressCity: 'contacts-form:documentEvidence.correction.fields.addressCity',
  barAssociation: 'contacts-form:documentEvidence.correction.fields.barAssociation',
  notaryDistrict: 'contacts-form:documentEvidence.correction.fields.notaryDistrict',
};

/** Η ετικέτα ενός πεδίου του διαλόγου: μέρος/εκδότης ⇒ δική του· αλλιώς της γραμμής του (ο αριθμός μητρώου). */
export function correctionFieldLabelKey(key: EvidenceFieldKey): string {
  switch (key) {
    case 'addressStreet':
    case 'addressNumber':
    case 'addressPostalCode':
    case 'addressCity':
    case 'barAssociation':
    case 'notaryDistrict':
      return CORRECTION_PART_KEYS[key];
    default:
      return CONTACT_EVIDENCE_ROW_KEYS[key];
  }
}

export const CONTACT_EVIDENCE_REASON_KEYS: Readonly<Record<EvidenceDismissReason, string>> = {
  'outdated-document': 'contacts-form:documentEvidence.reasons.outdatedDocument',
  misread: 'contacts-form:documentEvidence.reasons.misread',
  other: 'contacts-form:documentEvidence.reasons.other',
};

/** ADR-950 §11 — το κύριο κουμπί του διαλόγου όταν η διόρθωση συνεχίζει σε πράξη πάνω στην επαφή. */
export const CONTACT_EVIDENCE_FOLLOW_UP_KEYS: Readonly<Record<EvidenceFollowUp, string>> = {
  register: 'contacts-form:documentEvidence.correction.followUp.register',
  accept: 'contacts-form:documentEvidence.correction.followUp.accept',
  'propose-address': 'contacts-form:documentEvidence.correction.followUp.proposeAddress',
};
