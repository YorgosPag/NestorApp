/**
 * @fileoverview **Το προφίλ εταιρείας που χρειάζεται κάθε δημοσίευση βιτρίνας** — κοινό fixture
 * (ADR-841 §7 Α23).
 *
 * 🔴 Από την Α23 το δημόσιο όνομα **λύνεται** από το προφίλ (`accounting_settings/{companyId}`) μέσα
 * στη συναλλαγή του γραφέα. Κάθε σουίτα που δημοσιεύει βιτρίνα σε `FakeFirestore` χρειάζεται λοιπόν
 * προφίλ — ένα σημείο που το στήνει, όχι πέντε αντίγραφα (N.18).
 *
 * ⚠️ Όχι αρχείο δοκιμών: δεν ταιριάζει στο `*.test.ts`, άρα κανένας εκτελεστής δεν το τρέχει (3.47).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { GEMI_REGISTRY_SOURCE, type RegistryCompanyRecord } from '@/types/company-registry';
import type { ShowcaseLegalDeclaration } from '@/types/showcase-legal-identity';

/** «Η επωνυμία, με την προεπιλεγμένη έδρα» — η δήλωση που κάνει κάθε σουίτα που δεν κρίνει την ταυτότητα. */
export const LEGAL_NAME_CHOICE: ShowcaseLegalDeclaration = {
  publicName: { kind: 'legal-name' },
  seatDisclosure: null,
};

/** Ανώνυμη Εταιρεία ⇒ προεπιλογή `full` — ώστε το `seatDisclosure: null` να δημοσιεύεται. */
export const COMPANY_PROFILE = {
  entityType: 'ae',
  businessName: 'ΠΑΓΩΝΗΣ Α.Ε.',
  gemiNumber: '123456789000',
  address: 'Σαμοθράκης 16',
  city: 'Θεσσαλονίκη',
  postalCode: '54248',
} as const;

/** Το `FakeFirestore` πίσω από έναν `AdminFirestore` (οι σουίτες κρατούν μόνο τον δεύτερο). */
function fakeOf(db: unknown): FakeFirestore {
  return db as FakeFirestore;
}

export function givenCompanyProfile(db: unknown, companyId: string, overrides: Record<string, unknown> = {}): void {
  fakeOf(db).seed(COLLECTIONS.ACCOUNTING_SETTINGS, companyId, { ...COMPANY_PROFILE, ...overrides });
}

/** Η απάντηση του ΓΕΜΗ για το {@link COMPANY_PROFILE} — ίδια επωνυμία, ενεργή, με διακριτικό τίτλο. */
export function registryRecord(overrides: Partial<RegistryCompanyRecord> = {}): RegistryCompanyRecord {
  return {
    source: GEMI_REGISTRY_SOURCE,
    registrationNumber: '123456789000',
    legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
    legalNamesLatin: [],
    distinctiveTitles: ['ΠΑΓΩΝΗΣ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ'],
    distinctiveTitlesLatin: [],
    legalForm: { id: '3', label: 'ΑΕ' },
    status: { code: { id: '3', label: 'Ενεργή' }, activity: 'active' },
    seat: {
      street: 'ΣΑΜΟΘΡΑΚΗΣ',
      streetNumber: '16',
      postalCode: '54248',
      city: 'ΘΕΣΣΑΛΟΝΙΚΗ',
      municipality: { id: '0501', label: 'ΘΕΣΣΑΛΟΝΙΚΗΣ' },
    },
    isBranch: false,
    selfRegistered: true,
    ...overrides,
  };
}

export const REGISTRY_CHECKED_AT = '2026-09-14T09:00:00.000Z';

/** Αποθηκεύει την απάντηση **όπως τη γράφει** το `recordRegistryCheck`. */
export function givenRegistryCheck(
  db: unknown,
  companyId: string,
  record: RegistryCompanyRecord = registryRecord(),
): void {
  fakeOf(db).seed(COLLECTIONS.COMPANY_REGISTRY_RECORDS, companyId, {
    companyId,
    checkedAt: REGISTRY_CHECKED_AT,
    record,
  });
}
