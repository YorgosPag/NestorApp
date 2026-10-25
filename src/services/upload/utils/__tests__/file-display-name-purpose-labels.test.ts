/**
 * ADR-914 §8.25 — κάθε σκοπός κάτοψης έχει ετικέτα στο `files:purposes`, σε el ΚΑΙ en.
 *
 * Το `getPurposeLabel` γυρίζει το ίδιο το κλειδί όταν λείπει η ετικέτα, και το `buildFileDisplayName`
 * το γράφει στο αποθηκευμένο `displayName`: η εισαγωγή κάτοψης ακινήτου έβγαζε «Κατόψεις
 * property-floorplan - Μεζονέτα…» στην παραγωγή (2026-10-13). Ο κατάλογος σκοπών είναι το
 * `FLOORPLAN_PURPOSES`· νέος σκοπός χωρίς ετικέτα σπάει εδώ.
 */

import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { lookupLocaleString } from '@/i18n/locale-key-lookup';
import elFiles from '@/i18n/locales/el/files.json';
import enFiles from '@/i18n/locales/en/files.json';

const PURPOSES = Object.values(FLOORPLAN_PURPOSES);

describe('files:purposes — ετικέτα για κάθε σκοπό κάτοψης', () => {
  it.each([
    ['el', elFiles],
    ['en', enFiles],
  ] as const)('%s: κανένας σκοπός χωρίς ετικέτα', (_lng, bundle) => {
    const missing = PURPOSES.filter((purpose) => !lookupLocaleString(bundle, `purposes.${purpose}`));
    expect(missing).toEqual([]);
  });
});
