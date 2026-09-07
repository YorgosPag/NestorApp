/**
 * @fileoverview **Η ΤΙΜΗ ΠΟΥ ΔΗΛΩΝΕΙ Η ΟΘΟΝΗ ΤΟΥ ΣΗΜΑΤΟΣ ΕΠΙΒΙΩΝΕΙ ΩΣ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ;**
 *   (ADR-841 §7 Α21.8 · Φάση 3, ζωντανή επαλήθευση).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΥΠΑΡΧΕΙ — ΤΟ ΨΕΜΑ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΣΤΟ ΙΔΙΟ ΤΟ ΣΧΟΛΙΟ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το `useShowcaseMark` περνά `purpose: 'logo'` **με ρητή αιτιολογία**:
 *
 * > *«Και το `purpose` μένει `'logo'` για ΚΑΙ ΤΑ ΔΥΟ είδη: το χρησιμοποιεί μόνο το
 * > `FileNamingService`, και το `'avatar'` θα έγραφε «φωτογραφία προφίλ» πάνω σε
 * > λογότυπο εταιρείας.»*
 *
 * **ΜΕΤΡΗΘΗΚΕ ΖΩΝΤΑΝΑ (07/09, emulator)** ότι το αποθηκευμένο `FileRecord` λέει
 * `purpose="profile"` και `displayName="Φωτογραφίες Προφίλ"` — δηλαδή **ακριβώς τη
 * φράση που το σχόλιο δηλώνει ότι απέφυγε**.
 *
 * 🔑 **Η ΑΙΤΙΑ, ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΗ**: το `PHOTO_PURPOSES` έχει **τρεις** τιμές
 * *(`profile` · `id` · `other`)* και **δεν περιέχει `'logo'`**. Ο επιλυτής
 * {@link resolvePhotoPurpose} δεν βρίσκει την τιμή και **πέφτει σιωπηλά** στο
 * `PROFILE`. Ο μεταγλωττιστής σιώπησε επειδή η υπογραφή είναι `purpose?: string`,
 * όχι `PhotoPurpose` — δηλαδή το `'logo'` είναι **έγκυρο `string`**.
 *
 * ⚠️ **ΤΟ ΙΔΙΟ ΜΟΤΙΒΟ ΤΟ ΕΧΕΙ ΗΔΗ ΚΑΤΑΓΓΕΙΛΕΙ ΑΥΤΟ ΤΟ ΕΡΓΟ**, σε άλλο αρχείο:
 * *«το `'0000'` δεν σημαίνει «άγνωστο» … σεντινέλα που ξεπλένει σφάλμα σε νόμιμη
 * κατάσταση»* (`scripts/lib/esco/esco-occupation-document.ts`). Εδώ το `'profile'`
 * είναι **υπαρκτός σκοπός**, όχι «άγνωστο» — άρα η πτώση δεν φαίνεται ποτέ ως λάθος.
 *
 * 🔑 **ΓΙΑΤΙ Η ΥΠΑΡΧΟΥΣΑ ΑΓΚΥΡΑ ΗΤΑΝ ΠΡΑΣΙΝΗ**: το
 * `services/__tests__/photo-upload-utils.test.ts` δοκιμάζει τη **συνάρτηση** με
 * `'profile'` · `'id'` · `'other'` — τις τιμές που **περνούν**. Καμία δοκιμή δεν
 * ρώτησε *«και η τιμή που στέλνει ο ΖΩΝΤΑΝΟΣ καλών;»*. Ίδιο σχήμα με το Α21.8.8 Β:
 * **η συνάρτηση δοκιμάστηκε, η κλήση της όχι.**
 *
 * ⛔ **ΓΙ' ΑΥΤΟ Η ΤΙΜΗ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΗΝ ΠΗΓΗ**, δεν ξαναγράφεται εδώ: μια
 * χειρόγραφη `'logo'` σε αυτό το αρχείο θα έμενε πράσινη την ημέρα που το hook
 * αλλάξει τιμή — δηλαδή θα φύλαγε **τον εαυτό της**, όχι τον κώδικα.
 *
 * @module hooks/mandate/__tests__/showcase-mark-purpose
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvePhotoPurpose } from '@/services/photo-upload-types';

const HOOK_SOURCE = join(__dirname, '..', 'useShowcaseMark.ts');

/**
 * Ο **σκοπός που δηλώνει ο ζωντανός καλών**, διαβασμένος από την πηγή.
 *
 * ⚠️ Το `purpose:` πρέπει να είναι **μέσα** στην κλήση `PhotoUploadService.uploadPhoto`
 * — η αναζήτηση ξεκινά από εκεί ώστε να μην πιάσει τυχόν αναφορά σε σχόλιο.
 */
function declaredPurpose(): string {
  const source = readFileSync(HOOK_SOURCE, 'utf8');
  const callIndex = source.indexOf('PhotoUploadService.uploadPhoto(');
  expect(callIndex).toBeGreaterThan(-1);
  const match = source.slice(callIndex).match(/purpose:\s*'([^']+)'/);
  expect(match).not.toBeNull();
  return match![1];
}

describe('ADR-841 §7 Α21.8 — ο σκοπός του σήματος επιβιώνει', () => {
  it('ο ζωντανός καλών δηλώνει σκοπό (η πηγή τον λέει, όχι αυτό το αρχείο)', () => {
    expect(declaredPurpose().length).toBeGreaterThan(0);
  });

  it('🔴 ο δηλωμένος σκοπός ΔΕΝ ξεπλένεται σιωπηλά από τον επιλυτή', () => {
    const declared = declaredPurpose();
    expect(resolvePhotoPurpose(declared)).toBe(declared);
  });

  it('🔴 ο δηλωμένος σκοπός ΔΕΝ καταλήγει «profile» — τη φράση που το σχόλιο απέφευγε', () => {
    const declared = declaredPurpose();
    // Αν ο ίδιος ο καλών δηλώνει «profile», δεν υπάρχει ψέμα να φυλαχτεί.
    if (declared === 'profile') return;
    expect(resolvePhotoPurpose(declared)).not.toBe('profile');
  });
});
