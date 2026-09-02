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
  LISTING_MATERIAL_KEYS,
  listingAuthorshipVoice,
  type ListingAuthorshipVoice,
} from '../listing-authorship';
import el from '@/i18n/locales/el/search-results.json';
import en from '@/i18n/locales/en/search-results.json';
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

describe('Γ — ΤΟ ΥΛΙΚΟ ΕΧΕΙ ΠΡΟΕΛΕΥΣΗ, ΚΑΙ Η ΟΘΟΝΗ ΤΗ ΛΕΕΙ ΣΩΣΤΑ (Α15)', () => {
  /**
   * 🔴 **Η ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ**: κάνε τη χαρτογράφηση **σταθερή** —
   * δώσε στο `agency` τα κλειδιά του `owner-declared` *(δηλαδή γύρνα στην κατάσταση πριν
   * την Α15, όπου υπήρχε **μία** σταθερά)* ⇒ το **Γ2** πέφτει, και στα **δύο** σκέλη.
   *
   * ⚠️ Το Γ1 **δεν** αρκεί: μια σταθερή χαρτογράφηση περνά κάθε έλεγχο «υπάρχει κλειδί;»
   * — γι' αυτό ο φρουρός είναι η **διαφορά**, όχι η ύπαρξη.
   */
  it('🔴 Γ1 — ΚΑΘΕ κλάση γνώσης του σχήματος έχει ΚΑΙ ΤΑ ΔΥΟ κλειδιά (πλήρης παρονομαστής)', () => {
    // Ο παρονομαστής έρχεται από το **σχήμα**: νέα τιμή στο `LISTING_AUTHORSHIPS`
    // εμφανίζεται εδώ **αυτόματα**. (Ο μεταγλωττιστής το πιάνει ήδη μέσω του `Record`·
    // αυτό εδώ το κρατά αληθές και για όποιον διαβάζει μόνο τις άγκυρες.)
    for (const authorship of LISTING_AUTHORSHIPS) {
      const keys = LISTING_MATERIAL_KEYS[authorship];
      expect(keys.galleryAlt).toMatch(/^search-results:detail\.media\.galleryAlt\./);
      expect(keys.sourceNote).toMatch(/^search-results:detail\.media\.sourceNote\./);
    }
    expect(Object.keys(LISTING_MATERIAL_KEYS)).toHaveLength(LISTING_AUTHORSHIPS.length);
  });

  it('🔴 Γ2 — ΔΥΟ ΚΛΑΣΕΙΣ ⇒ ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΠΡΟΤΑΣΕΙΣ, και στα δύο κλειδιά', () => {
    // Αυτό είναι **ολόκληρο** το Ο-18 σε μία γραμμή: πριν την Α15 η αγγελία γραφείου
    // δανειζόταν την πρόταση του ιδιώτη και έλεγε *«υλικό του κατόχου»* — **ψευδές σε
    // 6 στις 7** ζωντανές αγγελίες με συλλογή, σε ενεργή δημόσια οθόνη.
    const owner = LISTING_MATERIAL_KEYS['owner-declared'];
    const agency = LISTING_MATERIAL_KEYS.agency;

    expect(agency.galleryAlt).not.toBe(owner.galleryAlt);
    expect(agency.sourceNote).not.toBe(owner.sourceNote);
  });

  it('🔴 Γ3 — ΚΑΘΕ κλειδί ΛΥΝΕΤΑΙ σε el ΚΑΙ σε en, χωρίς `defaultValue` (N.11)', () => {
    // Τα κλειδιά ταξιδεύουν ως **τιμές** — μπαίνουν στο δημοσιευμένο έγγραφο και
    // καταλήγουν αυτούσια σε `t()`. Το CHECK 3.8 βλέπει `t('κυριολεκτικό')`, άρα
    // **δεν βλέπει κανένα από αυτά**: ο μόνος φρουρός τους είναι εδώ.
    const resolve = (bundle: unknown, key: string): unknown =>
      key
        .slice('search-results:'.length)
        .split('.')
        .reduce<unknown>((node, segment) => (node as Record<string, unknown>)?.[segment], bundle);

    for (const authorship of LISTING_AUTHORSHIPS) {
      for (const key of Object.values(LISTING_MATERIAL_KEYS[authorship])) {
        const greek = resolve(el, key);
        const english = resolve(en, key);

        expect(typeof greek).toBe('string');
        expect(typeof english).toBe('string');
        expect(greek).not.toBe('');
        expect(english).not.toBe('');
        // 🔑 Και κάθε γλώσσα κουβαλά τη **δική της** πρόταση: αντιγραμμένο ελληνικό
        //    μέσα στο `en` περνά κάθε έλεγχο «υπάρχει;» και φτάνει στην οθόνη.
        expect(english).not.toBe(greek);
      }
    }
  });

  it('Γ4 — το ΦΥΛΛΟ του κλειδιού είναι η ΤΙΜΗ του σχήματος, ελεγμένο ΟΧΙ κατασκευασμένο', () => {
    // ⛔ Ο κώδικας **δεν** συνθέτει το κλειδί με συνένωση: ένα πρόθεμα δεν είναι
    //    συμβόλαιο. Η αντιστοιχία είναι ιδιότητα που θέλουμε **ελεγμένη** — αν κάποιος
    //    μετονομάσει ένα φύλλο, το μαθαίνει εδώ αντί να το ανακαλύψει στην οθόνη.
    const leaf = (key: string) => key.slice(key.lastIndexOf('.') + 1);

    expect(leaf(LISTING_MATERIAL_KEYS['owner-declared'].galleryAlt)).toBe('ownerDeclared');
    expect(leaf(LISTING_MATERIAL_KEYS['owner-declared'].sourceNote)).toBe('ownerDeclared');
    expect(leaf(LISTING_MATERIAL_KEYS.agency.galleryAlt)).toBe('agency');
    expect(leaf(LISTING_MATERIAL_KEYS.agency.sourceNote)).toBe('agency');
  });

  it('🔴 Γ5 — ΚΑΝΕΝΑ κλειδί δεν έμεινε στο ΠΑΛΙΟ, ΕΝΙΚΟ σπίτι', () => {
    // Το `detail.media.ownerNote` **ονόμαζε** τον ιδιώτη κάτοχο της σημείωσης — δηλαδή
    // το ίδιο το λεξιλόγιο ξαναγεννούσε το λάθος. Αν επιστρέψει, κάποιος ξανάγραψε
    // σταθερή πρόταση για δύο κλάσεις.
    for (const bundle of [el, en]) {
      const media = (bundle as { detail: { media: Record<string, unknown> } }).detail.media;
      expect(media.ownerNote).toBeUndefined();
      expect(typeof media.galleryAlt).toBe('object');
      expect(typeof media.sourceNote).toBe('object');
    }
  });
});
