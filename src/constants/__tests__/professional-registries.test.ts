/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΑΠΟΔΕΙΞΗΣ** — ADR-841 Α9.
 *
 * Ερώτημα: *«μπορεί μια αρχή μητρώου να υπάρχει **χωρίς να ξέρει κανείς** πόσους
 * εκδότες έχει, ή **χωρίς όνομα** σε μια από τις δύο γλώσσες;»*
 *
 * 🔴 **Γιατί υπάρχει — και γιατί ΔΕΝ αρκεί ο μεταγλωττιστής.** Τρεις από τους
 * τέσσερις ελέγχους εδώ **δεν είναι εκφράσιμοι σε τύπους**:
 *
 *   • Το `REGISTRY_AUTHORITY_PRESENTATION` είναι `Record<RegistryAuthorityId, …>`,
 *     άρα ο μεταγλωττιστής εγγυάται ότι **υπάρχει κλειδί** — **όχι** ότι το κλειδί
 *     **λύνεται** σε κείμενο. Ένα `${R}.tee.nmae` περνά τον τύπο και βγάζει ωμό
 *     κλειδί στην οθόνη.
 *   • Η **ισοτιμία el ⇄ en** ζει σε δύο JSON που κανένας τύπος δεν συγκρίνει. Ο
 *     N.11 λέει *«αν είναι hardcoded ελληνικά, τα αγγλικά τρέχουν ελληνικά»* — εδώ
 *     η αστοχία είναι η αδελφή της: κλειδί **μόνο** στο `el`, και το `en` δείχνει
 *     το ωμό κλειδί.
 *   • Το *«η ρίζα και ο πίνακας εκδοτών λένε το ίδιο»* το εγγυάται σήμερα το
 *     `satisfies`. Η άγκυρα φυλάει την **παλινδρόμηση**: αν κάποιος το αφαιρέσει
 *     για να «περάσει» μια έκτη αρχή, κοκκινίζει εδώ.
 *
 * ⚠️ **ΜΗΝ «απλοποιήσεις» συγκρίνοντας πλήθη κλειδιών.** Δύο locales με ίδιο πλήθος
 * και διαφορετικά κλειδιά είναι ακριβώς η αστοχία που ψάχνουμε.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-841-public-listing-body-and-platform-verticals.md — Α9
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  REGISTRY_AUTHORITIES,
  REGISTRY_AUTHORITY_SCOPE,
  REGISTRY_AUTHORITY_PRESENTATION,
  isChapteredRegistry,
  isNationalRegistry,
  isRegistryAuthority,
} from '@/constants/professional-registries';

const LOCALES = path.join(process.cwd(), 'src', 'i18n', 'locales');

/** Λύνει `ns:a.b.c` πάνω στο JSON μιας γλώσσας. Επιστρέφει `null` αν σπάσει η αλυσίδα. */
function resolveKey(language: string, fullKey: string): string | null {
  const [namespace, dotted] = fullKey.split(':');
  const file = path.join(LOCALES, language, `${namespace}.json`);
  if (!fs.existsSync(file)) return null;

  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  let cursor: unknown = parsed;
  for (const segment of dotted.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return null;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === 'string' ? cursor : null;
}

describe('ADR-841 Α9 — το λεξιλόγιο των αρχών μητρώου', () => {
  it('κάθε αρχή δηλώνει πόσους εκδότες έχει — καμία σιωπηλή προεπιλογή', () => {
    for (const authority of REGISTRY_AUTHORITIES) {
      expect(REGISTRY_AUTHORITY_SCOPE[authority]).toMatch(/^(national|chapter)$/);
    }
    // Και το αντίστροφο: κανένας εκδότης-φάντασμα εκτός ρίζας.
    expect(Object.keys(REGISTRY_AUTHORITY_SCOPE).sort()).toEqual([...REGISTRY_AUTHORITIES].sort());
  });

  it('οι δύο φρουροί διαμερίζουν το λεξιλόγιο — καμία αρχή και στα δύο, καμία σε κανένα', () => {
    for (const authority of REGISTRY_AUTHORITIES) {
      expect(isNationalRegistry(authority)).toBe(!isChapteredRegistry(authority));
    }
    expect(REGISTRY_AUTHORITIES.some(isChapteredRegistry)).toBe(true);
    expect(REGISTRY_AUTHORITIES.some(isNationalRegistry)).toBe(true);
  });

  it('ο φρουρός εισόδου απορρίπτει ό,τι δεν είναι στη ρίζα', () => {
    // Το σύνορο ανάγνωσης δέχεται `string` από το Firestore: παλιό έγγραφο,
    // τυπογραφικό, ή τιμή που καταργήθηκε ΔΕΝ επιτρέπεται να περάσει ως αρχή.
    expect(isRegistryAuthority('tee')).toBe(true);
    expect(isRegistryAuthority('TEE')).toBe(false);
    expect(isRegistryAuthority('bar')).toBe(false);
    expect(isRegistryAuthority('')).toBe(false);
    // Κληρονομημένες ιδιότητες του Object ΔΕΝ είναι αρχές.
    expect(isRegistryAuthority('constructor')).toBe(false);
    expect(isRegistryAuthority('toString')).toBe(false);
  });

  it('κάθε κλειδί παρουσίασης λύνεται σε κείμενο — ΚΑΙ στα ελληνικά ΚΑΙ στα αγγλικά', () => {
    for (const authority of REGISTRY_AUTHORITIES) {
      const { nameKey, abbreviationKey } = REGISTRY_AUTHORITY_PRESENTATION[authority];
      for (const key of [nameKey, abbreviationKey]) {
        expect(resolveKey('el', key)).toEqual(expect.any(String));
        expect(resolveKey('en', key)).toEqual(expect.any(String));
      }
    }
  });

  it('καμία ετικέτα δεν είναι κενή — «υπάρχει το κλειδί» δεν σημαίνει «λέει κάτι»', () => {
    for (const authority of REGISTRY_AUTHORITIES) {
      const { nameKey } = REGISTRY_AUTHORITY_PRESENTATION[authority];
      for (const language of ['el', 'en']) {
        expect((resolveKey(language, nameKey) ?? '').trim().length).toBeGreaterThan(0);
      }
    }
  });
});
