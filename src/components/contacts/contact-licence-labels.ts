/**
 * @fileoverview **Οι ετικέτες των αδειών της επαφής** (ADR-915 §40.5) — κλειστοί πίνακες κλειδιών, φωνή του γραφείου.
 * @module components/contacts/contact-licence-labels
 *
 * ⚠️ **Μέλη αντικειμένων, ποτέ δυναμικό `${…}`**: ο εξαγωγέας του slice (ADR-744) ακολουθεί μέλη πινάκων ετικετών.
 * 🔑 Το όνομα της άδειας, η αρχή και ο εκδότης **δεν** ξαναγράφονται: `PROFESSIONAL_LICENCE_SPECS[x].nameKey` ·
 *    `REGISTRY_AUTHORITY_PRESENTATION` · `CHAPTER_PRESENTATION`.
 */

import type { ContactLicenceRejection } from '@/lib/contacts/contact-licences';
import type { ContactLicenceSource } from '@/types/contacts/contact-licences';

export const CONTACT_LICENCE_KEYS = {
  legend: 'contacts-form:licences.legend',
  hint: 'contacts-form:licences.hint',
  hold: 'contacts-form:licences.hold',
  registryHint: 'contacts-form:licences.registryHint',
  provenanceLine: 'contacts-form:licences.provenanceLine',
  /** ADR-915 §40.5 — προέλευση ανά πεδίο, όταν η εγγραφή και οι τάξεις έχουν γραφτεί από άλλη πράξη. */
  provenanceRegistrationLine: 'contacts-form:licences.provenanceRegistrationLine',
  provenanceGradesLine: 'contacts-form:licences.provenanceGradesLine',
} as const;

/** ADR-915 §40.7 Φ2 — «Έλεγχος στο μητρώο»: η κρίση, η πράξη και ό,τι έμαθε η τελευταία ερώτηση. */
export const CONTACT_LICENCE_REGISTRY_KEYS = {
  region: 'contacts-form:licences.registry.region',
  check: 'contacts-form:licences.registry.check',
  checking: 'contacts-form:licences.registry.checking',
  recheck: 'contacts-form:licences.registry.recheck',
  notChecked: 'contacts-form:licences.registry.notChecked',
  verified: 'contacts-form:licences.registry.verified',
  gradeEntry: 'contacts-form:licences.registry.gradeEntry',
  differsFromDeclared: 'contacts-form:licences.registry.differsFromDeclared',
  aged: 'contacts-form:licences.registry.aged',
  nameMismatch: 'contacts-form:licences.registry.nameMismatch',
  staleNumber: 'contacts-form:licences.registry.staleNumber',
  failed: 'contacts-form:licences.registry.failed',
} as const;

/** Τι έμαθε η τελευταία ερώτηση, όταν **δεν** έφερε γραμμή — ολικός πάνω στα είδη της (εκτός `asked`/`not-asked`). */
export const CONTACT_LICENCE_REGISTRY_ATTEMPT_KEYS = {
  absent: 'contacts-form:licences.registry.attempt.absent',
  ambiguous: 'contacts-form:licences.registry.attempt.ambiguous',
  'layout-changed': 'contacts-form:licences.registry.attempt.layoutChanged',
  'unavailable-disabled': 'contacts-form:licences.registry.attempt.unavailableDisabled',
  'unavailable-network': 'contacts-form:licences.registry.attempt.unavailableNetwork',
  'unavailable-server': 'contacts-form:licences.registry.attempt.unavailableServer',
} as const;

/** Η προέλευση της τιμής — ολικός πάνω στο λεξιλόγιο. */
export const CONTACT_LICENCE_SOURCE_KEYS: Readonly<Record<ContactLicenceSource, string>> = {
  office: 'contacts-form:licences.sourceOffice',
  'self-declared': 'contacts-form:licences.sourceSelfDeclared',
};

/** Οι λόγοι άρνησης του σχηματισμού αδειών της επαφής — ολικός. */
export const CONTACT_LICENCE_REJECTION_KEYS: Readonly<Record<ContactLicenceRejection, string>> = {
  'licence-number-missing': 'contacts-form:validation.licences.licence-number-missing',
  'licence-duplicate': 'contacts-form:validation.licences.licence-duplicate',
  'licence-chapter-missing': 'contacts-form:validation.licences.licence-chapter-missing',
  'licence-grade-unknown': 'contacts-form:validation.licences.licence-grade-unknown',
};
