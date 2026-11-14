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
  provenanceRegion: 'contacts-form:licences.provenanceRegion',
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
};
