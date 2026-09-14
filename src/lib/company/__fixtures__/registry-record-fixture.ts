/**
 * @fileoverview **Η απάντηση του ΓΕΜΗ για τις άγκυρες** — ένα σημείο (ADR-841 §7 Α23, N.0.2).
 * @related types/company-registry.ts · lib/company/registry-identity-judgment.ts
 *
 * 🔴 Ζούσε σε **τέσσερα** σημεία: τρία σχεδόν ίδια `const RECORD` (κριτής, επαλήθευση, αποθήκη) και το
 * `registryRecord()` του `services/mandate/__tests__/showcase-legal-fixture`, που το εισήγαγε **και** τεστ
 * του `lib` — δηλαδή άγκυρα καθαρού κριτή εξαρτιόταν από fixture υπηρεσίας. Νέο πεδίο στο
 * `RegistryCompanyRecord` θα ζητούσε τέσσερις διορθώσεις, και η τέταρτη θα ξεχνιόταν.
 *
 * 🔑 Ζει στο `lib`, δίπλα στον κριτή: ο **χαμηλότερος** καταναλωτής ορίζει τη θέση, ώστε κανένα τεστ να μην
 * εισάγει προς τα πάνω. Κάθε σουίτα κρατά τις δικές της τιμές με `overrides` — ό,τι **κρίνει** τη
 * γράφει ρητά, ό,τι δεν κρίνει το παίρνει από εδώ.
 *
 * ⚠️ Όχι αρχείο δοκιμών: δεν ταιριάζει στο `*.test.ts`, άρα κανένας εκτελεστής δεν το τρέχει (3.47).
 */

import {
  GEMI_REGISTRY_SOURCE,
  type RegistryCheck,
  type RegistryCompanyRecord,
} from '@/types/company-registry';

export const REGISTRY_CHECKED_AT = '2026-09-14T09:00:00.000Z';

/** Ενεργή ΑΕ με διακριτικό τίτλο και **πλήρη** έδρα (ώστε ο φρουρός αποθήκης να διαβάζει κάθε πεδίο). */
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

/** Μία ερώτηση προς το μητρώο — η απάντηση **και** πότε έγινε. */
export function registryCheck(overrides: Partial<RegistryCompanyRecord> = {}): RegistryCheck {
  return { record: registryRecord(overrides), checkedAt: REGISTRY_CHECKED_AT };
}
