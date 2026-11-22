/**
 * @fileoverview **Η ΕΠΑΦΗ ΩΣ ΥΠΟΚΕΙΜΕΝΟ ΕΛΕΓΧΟΥ ΣΤΟ ΓΕΜΗ** — τι κρατά και με τι ρωτάμε (ADR-948 §8 Βήμα 4).
 * @module lib/contacts/contact-registry-subject
 *
 * 🔑 Καμία νέα ανάγνωση πεδίων: τα βαθμωτά έρχονται από τον **έναν** πίνακα `readCompanyScalarFields`
 * (ADR-332 §D30 — `gemiNumber` με κάτοπτρο `registrationNumber`, `gemiStatus` στα `customFields`), η έδρα από
 * τον **έναν** αναγνώστη λίστας `resolveContactAddresses` — **θέση 0**, και μόνο αυτή (`contact-hq-state.ts`).
 *
 * 🔑 Το ερώτημα (`ContactRegistryQuery`) υπολογίζεται **ξανά** μέσα στη συναλλαγή εγγραφής: αν διαφέρει από αυτό
 * με το οποίο ρωτήσαμε, η απάντηση δεν αφορά πια την επαφή και δεν γράφεται (πρότυπο ADR-841 §7 Α23.12).
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import type { ContactRegistryFields, SeatFields } from '@/lib/company/contact-registry-comparison';
import { isValidGreekVat, normalizeVat } from '@/lib/validation/greek-vat-number';
import type { Contact } from '@/types/contacts';
import type { ContactRegistryQuery } from '@/types/contact-registry-check';
import { readCompanyScalarFields } from '@/utils/contactForm/schema/company-field-schema';
import { resolveContactAddresses } from '@/utils/contacts/contact-addresses-reader';

/** Το έγγραφο επαφής όπως βγαίνει από τη βάση — ωμό, χωρίς υπόσχεση σχήματος. */
export type StoredContactDocument = Readonly<Record<string, unknown>> & {
  readonly customFields?: Readonly<Record<string, unknown>>;
};

const NO_QUERY: ContactRegistryQuery = { kind: 'none' };

/** Κενό κείμενο = απουσία. */
function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Μόνο επαφή-εταιρεία ελέγχεται στο ΓΕΜΗ — η ατομική/φυσικό πρόσωπο δεν φτάνει ποτέ ως εδώ (§8.3). */
export function isCompanyContact(doc: StoredContactDocument): boolean {
  return doc.type === 'company';
}

/** Η έδρα = **θέση 0** της λίστας διευθύνσεων· `null` όταν η επαφή δεν έχει διεύθυνση. */
function headquartersOf(doc: StoredContactDocument): SeatFields | null {
  // Ο αναγνώστης δέχεται `Contact` αλλά διαβάζει ο ίδιος ωμά `customFields`/`companyAddresses`/`addresses`.
  const hq = resolveContactAddresses(doc as unknown as Contact, 'company')[0];
  if (hq === undefined) return null;
  return {
    street: textOrNull(hq.street ?? ''),
    number: textOrNull(hq.number ?? ''),
    postalCode: textOrNull(hq.postalCode ?? ''),
    city: textOrNull(hq.city ?? ''),
  };
}

/** Το έγγραφο επαφής ⇒ τα έξι πεδία της φάσης 1 (ADR-948 §8.5), ωμά όπως είναι αποθηκευμένα. */
export function contactRegistryFieldsOf(doc: StoredContactDocument): ContactRegistryFields {
  const scalars = readCompanyScalarFields(doc);
  return {
    companyName: textOrNull(scalars.companyName),
    tradeName: textOrNull(scalars.tradeName),
    gemiNumber: textOrNull(scalars.gemiNumber),
    legalForm: textOrNull(scalars.legalForm),
    gemiStatus: textOrNull(scalars.gemiStatus),
    headquarters: headquartersOf(doc),
  };
}

/** Με τι ρωτάμε: έγκυρος Αρ. ΓΕΜΗ της επαφής, αλλιώς έγκυρο ΑΦΜ, αλλιώς τίποτα. */
export function contactRegistryQueryOf(doc: StoredContactDocument): ContactRegistryQuery {
  const scalars = readCompanyScalarFields(doc);
  const registrationNumber = canonicalGemiNumber(scalars.gemiNumber);
  if (registrationNumber !== null) return { kind: 'gemi-number', registrationNumber };
  if (isValidGreekVat(scalars.vatNumber)) return { kind: 'tax-id', taxId: normalizeVat(scalars.vatNumber) };
  return NO_QUERY;
}

/** Ίδιο ερώτημα; — η συνθήκη της εγγραφής μέσα στη συναλλαγή. */
export function sameRegistryQuery(a: ContactRegistryQuery, b: ContactRegistryQuery): boolean {
  if (a.kind === 'gemi-number' && b.kind === 'gemi-number') return a.registrationNumber === b.registrationNumber;
  if (a.kind === 'tax-id' && b.kind === 'tax-id') return a.taxId === b.taxId;
  return a.kind === 'none' && b.kind === 'none';
}
