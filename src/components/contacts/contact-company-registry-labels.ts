/**
 * @fileoverview **Οι ετικέτες του «Έλεγχος στο ΓΕΜΗ»** της επαφής-εταιρείας (ADR-948 §8 Βήμα 7) — κλειστοί πίνακες κλειδιών.
 * @module components/contacts/contact-company-registry-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744 · CHECK 3.34) ακολουθεί μέλη πινάκων.
 * 🔑 Ό,τι υπάρχει ήδη **δεν** ξαναγράφεται: ονόματα πεδίων → `fieldLabels` (`forms`) · τιμές νομικής μορφής /
 *    κατάστασης → `VOCAB_LEGAL_FORMS` / `VOCAB_GEMI_STATUSES` (`forms`) · μέρη διεύθυνσης → `contacts-form:address.fields`.
 */

import type { FieldComparisonState, SeatPart } from '@/lib/company/contact-registry-comparison';
import type { LegalFormRefusal } from '@/lib/company/registry-legal-person';
import type { RegistryUnavailableReason } from '@/types/company-registry';

export const CONTACT_COMPANY_REGISTRY_KEYS = {
  title: 'contacts-form:companyRegistry.title',
  hint: 'contacts-form:companyRegistry.hint',
  check: 'contacts-form:companyRegistry.check',
  recheck: 'contacts-form:companyRegistry.recheck',
  checking: 'contacts-form:companyRegistry.checking',
  notChecked: 'contacts-form:companyRegistry.notChecked',
  checkedAt: 'contacts-form:companyRegistry.checkedAt',
  failed: 'contacts-form:companyRegistry.failed',
  noComparison: 'contacts-form:companyRegistry.noComparison',
  inactive: 'contacts-form:companyRegistry.inactive',
  incomplete: 'contacts-form:companyRegistry.incomplete',
  unsavedHint: 'contacts-form:companyRegistry.unsavedHint',
  attributionSource: 'contacts-form:companyRegistry.attributionSource',
  attributionLicence: 'contacts-form:companyRegistry.attributionLicence',
} as const;

/** Ο πίνακας σύγκρισης. */
export const CONTACT_COMPANY_REGISTRY_TABLE_KEYS = {
  caption: 'contacts-form:companyRegistry.table.caption',
  field: 'contacts-form:companyRegistry.table.field',
  contact: 'contacts-form:companyRegistry.table.contact',
  registry: 'contacts-form:companyRegistry.table.registry',
  state: 'contacts-form:companyRegistry.table.state',
  empty: 'contacts-form:companyRegistry.table.empty',
  accept: 'contacts-form:companyRegistry.table.accept',
  acceptAria: 'contacts-form:companyRegistry.table.acceptAria',
  seat: 'contacts-form:companyRegistry.table.seat',
  seatPropose: 'contacts-form:companyRegistry.table.seatPropose',
  seatProposeHint: 'contacts-form:companyRegistry.table.seatProposeHint',
} as const;

/** Η κρίση ανά γραμμή — ολικός πάνω στις τέσσερις καταστάσεις. */
export const CONTACT_COMPANY_REGISTRY_STATE_KEYS: Readonly<Record<FieldComparisonState, string>> = {
  match: 'contacts-form:companyRegistry.state.match',
  missing: 'contacts-form:companyRegistry.state.missing',
  differs: 'contacts-form:companyRegistry.state.differs',
  'not-comparable': 'contacts-form:companyRegistry.state.notComparable',
};

/** Τα μέρη της έδρας — οι **υπάρχουσες** ετικέτες της φόρμας. */
export const CONTACT_COMPANY_SEAT_PART_KEYS: Readonly<Record<SeatPart, string>> = {
  street: 'contacts-form:address.fields.street',
  number: 'contacts-form:address.fields.streetNumber',
  postalCode: 'contacts-form:address.fields.postalCode',
  city: 'contacts-form:address.fields.city',
};

/** Τι έμαθε η τελευταία ερώτηση, όταν **δεν** έφερε απάντηση — ολικός (εκτός `asked`/`not-asked`/`ambiguous`/`refused`/`unavailable`). */
export const CONTACT_COMPANY_REGISTRY_ATTEMPT_KEYS = {
  'not-found': 'contacts-form:companyRegistry.attempt.notFound',
  'contact-changed': 'contacts-form:companyRegistry.attempt.contactChanged',
  'no-identifier': 'contacts-form:companyRegistry.attempt.noIdentifier',
  ambiguous: 'contacts-form:companyRegistry.attempt.ambiguous',
} as const;

/** Ο φράχτης «όχι φυσικό πρόσωπο» αρνήθηκε — ολικός πάνω στους λόγους. */
export const CONTACT_COMPANY_REGISTRY_REFUSAL_KEYS: Readonly<Record<LegalFormRefusal, string>> = {
  'natural-person': 'contacts-form:companyRegistry.refused.naturalPerson',
  'no-legal-form': 'contacts-form:companyRegistry.refused.noLegalForm',
  unmapped: 'contacts-form:companyRegistry.refused.unmapped',
  'catalog-drift': 'contacts-form:companyRegistry.refused.catalogDrift',
  unclassifiable: 'contacts-form:companyRegistry.refused.unclassifiable',
};

/** Δεν μπόρεσα να ρωτήσω — **ποτέ** «δεν υπάρχει». Ολικός πάνω στους λόγους. */
export const CONTACT_COMPANY_REGISTRY_UNAVAILABLE_KEYS: Readonly<Record<RegistryUnavailableReason, string>> = {
  'not-configured': 'contacts-form:companyRegistry.unavailable.notConfigured',
  unauthorized: 'contacts-form:companyRegistry.unavailable.unauthorized',
  'rate-limited': 'contacts-form:companyRegistry.unavailable.rateLimited',
  server: 'contacts-form:companyRegistry.unavailable.server',
  network: 'contacts-form:companyRegistry.unavailable.network',
  'malformed-response': 'contacts-form:companyRegistry.unavailable.malformedResponse',
};

/** Η λωρίδα πρότασης έδρας μέσα στον editor διευθύνσεων. */
export const HQ_ADDRESS_PROPOSAL_KEYS = {
  notice: 'contacts-form:addressesSection.registryProposal.notice',
  undo: 'contacts-form:addressesSection.registryProposal.undo',
  keep: 'contacts-form:addressesSection.registryProposal.keep',
} as const;
