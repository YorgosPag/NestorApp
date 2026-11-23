/**
 * @fileoverview Τα κλειδιά i18n του πίνακα «Το έγγραφο λέει / Η επαφή λέει» (ADR-950 §4.4) — ο ΕΝΑΣ χάρτης.
 * @module components/contacts/document-evidence/contact-evidence-labels
 *
 * `Record` πάνω στις ρίζες των λεξιλογίων ⇒ νέα κρίση, αιτία ή γραμμή **χωρίς** ετικέτα = σφάλμα μεταγλώττισης,
 * όχι ωμό κλειδί στην οθόνη (ίδιο σχήμα με το `contact-company-registry-labels`). Πλήρη literal κλειδιά — οι πύλες
 * i18n (3.8 · 3.13) τα διαβάζουν **στατικά**.
 */

import type { EvidenceDismissReason, EvidenceRowKey } from '@/config/contact-document-evidence';
import type { UngroundedReason } from '@/lib/contacts/contact-evidence-grounding';
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
  personaRequired: 'contacts-form:documentEvidence.actions.personaRequired',
  compareOnly: 'contacts-form:documentEvidence.actions.compareOnly',
  dismissFailed: 'contacts-form:documentEvidence.errors.dismissFailed',
  restoreFailed: 'contacts-form:documentEvidence.errors.restoreFailed',
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

export const CONTACT_EVIDENCE_UNGROUNDED_KEYS: Readonly<Record<UngroundedReason, string>> = {
  absent: 'contacts-form:documentEvidence.ungrounded.absent',
  'low-confidence': 'contacts-form:documentEvidence.ungrounded.lowConfidence',
  'failed-check': 'contacts-form:documentEvidence.ungrounded.failedCheck',
};

export const CONTACT_EVIDENCE_REASON_KEYS: Readonly<Record<EvidenceDismissReason, string>> = {
  'outdated-document': 'contacts-form:documentEvidence.reasons.outdatedDocument',
  misread: 'contacts-form:documentEvidence.reasons.misread',
  other: 'contacts-form:documentEvidence.reasons.other',
};
