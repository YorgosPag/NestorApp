/**
 * Άγκυρες της **μίας απόφασης**: *ποια από τις τρεις προτάσεις λέει αυτή η αγγελία*
 * (ADR-841 Α13.2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΙΣ ΑΓΚΥΡΕΣ ΤΩΝ ΔΥΟ ΟΘΟΝΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι άγκυρες της οθόνης ρωτούν *«ζωγραφίζεται;»* — και μπορούν να μείνουν πράσινες με
 * **λάθος** επιλογή, αρκεί κάτι να ζωγραφιστεί. Αυτό εδώ ρωτά *«ποια πρόταση, και
 * γιατί»*, **εξαντλητικά**, χωρίς DOM: είναι η μόνη θέση όπου ο **παρονομαστής** είναι
 * ολόκληρο το `ListingAuthorshipVoice` και όχι όσα θυμήθηκε ο συγγραφέας της οθόνης.
 *
 * 🔴 **Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ**: αν ο κλάδος `agencyName === null` γίνει
 * `agencyName !== null`, το Α2 και το Α3 κοκκινίζουν. Αν σβήσει ολόκληρος ο έλεγχος
 * επωνυμίας, κοκκινίζει το Α2. Αν η συνάρτηση επιστρέψει σταθερά μία τιμή, κοκκινίζουν
 * τρία από τα τέσσερα.
 */

import {
  LISTING_AUTHORSHIP_KEYS,
  listingAuthorshipVoice,
  type ListingAuthorshipVoice,
} from '../listing-authorship';
import { LISTING_AUTHORSHIPS } from '@/types/public-listing';

describe('Α — οι τρεις φωνές, από δύο πεδία', () => {
  it('Α1 — γραφείο ΜΕ επωνυμία', () => {
    expect(listingAuthorshipVoice({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.' })).toBe(
      'agency-named',
    );
  });

  it('🔴 Α2 — γραφείο ΧΩΡΙΣ επωνυμία είναι ΔΙΚΗ ΤΟΥ κατάσταση, όχι υποπερίπτωση', () => {
    // Αν συμπτυσσόταν με το Α1, η οθόνη θα τύπωνε κενό «Από γραφείο: » — που
    // διαβάζεται ως **σπασμένη οθόνη**, όχι ως απουσία πληροφορίας.
    expect(listingAuthorshipVoice({ authorship: 'agency', agencyName: null })).toBe(
      'agency-anonymous',
    );
  });

  it('Α3 — δήλωση ιδιοκτήτη ΑΓΝΟΕΙ την επωνυμία, ακόμη κι αν υπάρχει', () => {
    // ⚠️ Ο παρονομαστής που δεν φαίνεται: η κλάση αποφασίζει **πρώτη**. Μια αγγελία
    //    ιδιοκτήτη με κατά λάθος συμπληρωμένη επωνυμία **δεν** γίνεται αγγελία γραφείου.
    expect(
      listingAuthorshipVoice({ authorship: 'owner-declared', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.' }),
    ).toBe('owner-declared');
  });

  it('🔴 Α4 — ΚΑΘΕ κλάση του σχήματος έχει φωνή (πλήρης παρονομαστής)', () => {
    // Η λίστα έρχεται από το **σχήμα**, όχι από αυτό το αρχείο: νέα τιμή στο
    // `LISTING_AUTHORSHIPS` εμφανίζεται εδώ **αυτόματα** και μένει χωρίς απάντηση.
    for (const authorship of LISTING_AUTHORSHIPS) {
      const voice = listingAuthorshipVoice({ authorship, agencyName: null });
      expect(typeof voice).toBe('string');
      expect(voice.length).toBeGreaterThan(0);
    }
  });
});

describe('Β — ο πίνακας κλειδιών είναι ΔΕΥΤΕΡΗ ΦΩΝΗ, όχι διακόσμηση', () => {
  it('🔴 Β1 — κάθε φωνή που μπορεί να παραχθεί ΕΧΕΙ κλειδί', () => {
    // Ο παρονομαστής είναι οι φωνές που **παράγονται πραγματικά**, όχι όσες δηλώνονται:
    // ένα κλειδί για φωνή που δεν παράγεται ποτέ θα ήταν φρουρός που δεν πυροδοτεί.
    const produced = new Set<ListingAuthorshipVoice>([
      listingAuthorshipVoice({ authorship: 'agency', agencyName: 'x' }),
      listingAuthorshipVoice({ authorship: 'agency', agencyName: null }),
      listingAuthorshipVoice({ authorship: 'owner-declared', agencyName: null }),
    ]);

    for (const voice of produced) {
      expect(LISTING_AUTHORSHIP_KEYS[voice]).toMatch(/^listing\.authorship\./);
    }
    expect(produced.size).toBe(Object.keys(LISTING_AUTHORSHIP_KEYS).length);
  });

  it('Β2 — τα κλειδιά είναι ΞΕΧΩΡΙΣΤΑ μεταξύ τους', () => {
    const values = Object.values(LISTING_AUTHORSHIP_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('🔴 Β3 — ΚΑΝΕΝΑ κλειδί δεν ζει πια κάτω από το `card.`', () => {
    // Α13.1: το πρόθεμα μετονομάστηκε ΟΛΟΚΛΗΡΟ. Αυτή η γραμμή είναι ο φρουρός που
    // εμποδίζει να ξαναγυρίσει **μία** ομάδα πίσω, αφήνοντας δύο κανόνες σε ισχύ.
    for (const key of Object.values(LISTING_AUTHORSHIP_KEYS)) {
      expect(key.startsWith('card.')).toBe(false);
    }
  });
});
