/**
 * @fileoverview **ADR-824 Φάση 4 — ΤΟ ΜΕΝΟΥ ΔΕΝ ΠΡΟΣΦΕΡΕΙ ΡΥΘΜΙΖΟΜΕΝΗ ΔΟΥΛΕΙΑ.**
 * @related ADR-824 §8 · config/navigation-capability.ts · types/organization-capability.ts
 *
 * ⛔ **ΔΕΝ δοκιμάζει ασφάλεια.** Ο φρουρός είναι ο τύπος `BrokerageAuthority` στον
 * διακομιστή. Εδώ κρίνεται **τι προσφέρεται στην οθόνη** — και ειδικά ότι το «κρύψε»
 * και το «επίτρεψε» παραμένουν **δύο διαφορετικά ερωτήματα** που δεν συγχωνεύονται.
 *
 * 🔴 **ΚΑΘΕ ΟΜΑΔΑ ΕΧΕΙ ΠΑΡΟΝΟΜΑΣΤΗ.** Ένα test που βεβαιώνει μόνο «κρύφτηκε» μένει
 * πράσινο και όταν το φίλτρο κρύβει **τα πάντα** — δηλαδή όταν είναι εντελώς
 * χαλασμένο. Γι' αυτό κάθε ομάδα δείχνει και **τι ΕΠΙΒΙΩΝΕΙ**.
 */

import { getMainMenuItems } from '@/config/navigation';
import {
  CAPABILITY_GATED_ROUTES,
  filterItemsByCapability,
  isRouteOfferable,
  type OrganizationCapabilityView,
} from '@/config/navigation-capability';
import {
  CAPABILITY_STATUSES,
  isCapabilityActive,
  isCapabilityKnownToOrganization,
  type CapabilityStatus,
} from '@/types/organization-capability';

/** Η διαδρομή που ο Ν. 4072/2012 ρυθμίζει. */
const MANDATES = '/listings/mandates';

function viewWith(status: CapabilityStatus): OrganizationCapabilityView {
  return { brokerage_listings: status };
}

// =============================================================================
// ΟΜΑΔΑ Λ — ΤΟ ΛΕΞΙΛΟΓΙΟ: «ΞΕΡΕΙ ΟΤΙ ΥΠΑΡΧΕΙ;» ΔΕΝ ΕΙΝΑΙ «ΕΠΙΤΡΕΠΕΤΑΙ;»
// =============================================================================

describe('Λ — «το ξέρει;» και «επιτρέπεται;» είναι ΔΥΟ ερωτήματα', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το `isCapabilityKnownToOrganization` να επιστρέφει `true`
   *    για `'unrequested'` ⇒ κόκκινο. Είναι ο πυρήνας της απόφασης του Giorgio:
   *    σε αρχιτέκτονα που δεν ζήτησε ποτέ **δεν διαφημίζεται** η μεσιτεία.
   */
  it('Λ1 — «δεν ζήτησε ποτέ» ⇒ ΔΕΝ προσφέρεται', () => {
    expect(isCapabilityKnownToOrganization('unrequested')).toBe(false);
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το `pending` ή το `revoked` να επιστρέφει `false` ⇒ κόκκινο.
   *    Αυτοί **ξέρουν ήδη** ότι υπάρχει· σιωπή απέναντί τους είναι εξαφάνιση χωρίς
   *    εξήγηση — το γραφείο που δήλωσε δεν μαθαίνει ότι εκκρεμεί, και αυτό που
   *    έχασε την άδεια δεν μαθαίνει γιατί.
   */
  it.each([['pending'], ['revoked'], ['active']] as const)(
    'Λ2 — «%s» ⇒ προσφέρεται (με το μήνυμά του)',
    (status) => {
      expect(isCapabilityKnownToOrganization(status)).toBe(true);
    },
  );

  /**
   * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΟΜΑΔΑΣ, ΚΑΙ Η ΑΓΚΥΡΑ ΚΑΤΑ ΤΗΣ «ΚΕΝΤΡΙΚΟΠΟΙΗΣΗΣ».**
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε τα δύο κατηγορήματα να συμφωνούν (π.χ. γράψε το
   *    `isCapabilityKnownToOrganization` ως `isCapabilityActive`, ή τον φρουρό ως
   *    `!== 'unrequested'` — η μετάλλαξη Κ3 του §8) ⇒ κόκκινο.
   *
   * Χωρίς αυτό, κάποιος που βλέπει δύο συναρτήσεις με «παρόμοιο» σώμα θα τις ένωνε,
   * και η ένωση **και προς τις δύο κατευθύνσεις** είναι καταστροφική: ή κρύβεται το
   * `pending` (σιωπή), ή **περνά** το `pending` στον φρουρό (παράνομη δημοσίευση).
   */
  it.each([['pending'], ['revoked']] as const)(
    'Λ3 — στο «%s» τα δύο ερωτήματα ΔΙΑΦΩΝΟΥΝ: προσφέρεται αλλά ΔΕΝ επιτρέπεται',
    (status) => {
      expect(isCapabilityKnownToOrganization(status)).toBe(true);
      expect(isCapabilityActive(status)).toBe(false);
    },
  );

  /** Ο δεύτερος παρονομαστής: στο `active` συμφωνούν — άρα η διαφωνία δεν είναι καθολική. */
  it('Λ4 — στο «active» συμφωνούν', () => {
    expect(isCapabilityKnownToOrganization('active')).toBe(true);
    expect(isCapabilityActive('active')).toBe(true);
  });

  /**
   * ⚠️ **Το `@swc/jest` ΣΒΗΝΕΙ τους τύπους**, άρα «πέμπτη κατάσταση δεν μεταγλωττίζεται»
   * **δεν** είναι εφικτή άγκυρα εδώ — το επιβάλλει ο μεταγλωττιστής, όχι αυτό το test.
   * Αυτό που **μπορεί** να ελεγχθεί εκτελώντας: ότι καμία γνωστή κατάσταση δεν πέφτει
   * σε σιωπηλό `undefined` (δηλαδή ότι το `switch` απαντά σε **όλες**).
   */
  it('Λ5 — κάθε δηλωμένη κατάσταση παίρνει ρητή απάντηση boolean', () => {
    for (const status of CAPABILITY_STATUSES) {
      expect(typeof isCapabilityKnownToOrganization(status)).toBe('boolean');
    }
  });
});

// =============================================================================
// ΟΜΑΔΑ Π — Ο ΠΙΝΑΚΑΣ ΚΑΙ ΤΟ ΦΙΛΤΡΟ
// =============================================================================

describe('Π — ποια διαδρομή προσφέρεται', () => {
  it('Π1 — ο πίνακας δένει τον κατάλογο εντολών με τη μεσιτική ικανότητα', () => {
    expect(CAPABILITY_GATED_ROUTES.get(MANDATES)).toBe('brokerage_listings');
  });

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τη γραμμή του πίνακα ⇒ κόκκινο (η διαδρομή ξαναπροσφέρεται). */
  it('Π2 — «δεν ζήτησε ποτέ» ⇒ ο κατάλογος εντολών ΔΕΝ προσφέρεται', () => {
    expect(isRouteOfferable(MANDATES, viewWith('unrequested'))).toBe(false);
  });

  it.each([['pending'], ['active'], ['revoked']] as const)(
    'Π3 — «%s» ⇒ ο κατάλογος εντολών προσφέρεται',
    (status) => {
      expect(isRouteOfferable(MANDATES, viewWith(status))).toBe(true);
    },
  );

  /**
   * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ.**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το «άγνωστη διαδρομή ⇒ κρύψ' την» (fail-closed στο φίλτρο) ⇒
   *    κόκκινο. Θα έκρυβε **ολόκληρο** το μενού την πρώτη φορά που κάποιος ξεχνούσε
   *    γραμμή — το ίδιο λάθος που το `isRouteVisibleForJob` τεκμηριώνει ότι πλήρωσε
   *    ζωντανά με το `/legal-documents`.
   */
  it('Π4 — αταξινόμητη διαδρομή προσφέρεται ΠΑΝΤΑ, ακόμη και χωρίς καμία ικανότητα', () => {
    expect(isRouteOfferable('/contacts', viewWith('unrequested'))).toBe(true);
    expect(isRouteOfferable('/projects', viewWith('unrequested'))).toBe(true);
  });
});

describe('Π/Υ — το φίλτρο κόβει ό,τι δεν προσφέρεται, και ΜΟΝΟ αυτό', () => {
  const tree = [
    { href: '/contacts' },
    { href: MANDATES },
    { href: '/projects' },
  ] as const;

  it('Υ1 — «δεν ζήτησε ποτέ»: φεύγει η μία γραμμή, μένουν οι άλλες', () => {
    const kept = filterItemsByCapability([...tree], viewWith('unrequested'));
    expect(kept.map((i) => i.href)).toEqual(['/contacts', '/projects']);
  });

  /** Ο παρονομαστής: με ικανότητα, **τίποτα** δεν χάνεται. */
  it('Υ2 — «active»: το δέντρο μένει ΑΚΕΡΑΙΟ', () => {
    const kept = filterItemsByCapability([...tree], viewWith('active'));
    expect(kept.map((i) => i.href)).toEqual(['/contacts', MANDATES, '/projects']);
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το φίλτρο ρηχό (μην κατεβαίνεις στα `subItems`) ⇒ κόκκινο.
   *
   * Σήμερα ο πίνακας έχει **μόνο** διαδρομή πρώτου επιπέδου, άρα ένα ρηχό φίλτρο θα
   * περνούσε κάθε άλλη δοκιμή — και θα αστοχούσε **σιωπηλά** την ημέρα που μια
   * ρυθμιζόμενη διαδρομή μπει ως υπο-στοιχείο.
   */
  it('Υ3 — αναδρομικό: ρυθμιζόμενο υπο-στοιχείο φεύγει, τα αδέλφια του μένουν', () => {
    const nested = [
      {
        href: '/listings',
        subItems: [{ href: MANDATES }, { href: '/listings/public' }],
      },
    ];
    const kept = filterItemsByCapability(nested, viewWith('unrequested'));

    expect(kept).toHaveLength(1);
    expect(kept[0]?.subItems?.map((s) => s.href)).toEqual(['/listings/public']);
  });

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: κράτα τα παιδιά όταν πέφτει ο γονιός ⇒ κόκκινο. */
  it('Υ4 — όταν πέφτει ο γονιός, πέφτουν μαζί του και τα παιδιά', () => {
    const nested = [{ href: MANDATES, subItems: [{ href: '/listings/mandates/new' }] }];
    expect(filterItemsByCapability(nested, viewWith('unrequested'))).toEqual([]);
  });

  /**
   * Το φίλτρο **αντιγράφει**, δεν μεταλλάσσει: ο καλών κρατά το αφιλτράριστο δέντρο.
   *
   * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΗΤΑΝ ΨΕΥΤΙΚΗ** — μετρήθηκε με μετάλλαξη:
   * κοίταζε **μόνο** τα `href` του πρώτου επιπέδου, που το φίλτρο δεν αγγίζει ποτέ.
   * Έμενε **πράσινη** ενώ το φίλτρο έγραφε πάνω στα `subItems` του καλούντος. Πλέον
   * κρίνει το **βάθος**, εκεί που η μετάλλαξη πραγματικά χτυπά.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γράψε `item.subItems = filterItemsByCapability(...)` αντί για
   *    `Object.assign({}, item, …)` ⇒ κόκκινο.
   */
  it('Υ5 — η είσοδος ΔΕΝ μεταλλάσσεται, ούτε σε βάθος', () => {
    const child = { href: MANDATES };
    const sibling = { href: '/listings/public' };
    const input = [{ href: '/listings', subItems: [child, sibling] }];

    filterItemsByCapability(input, viewWith('unrequested'));

    expect(input[0]?.subItems).toHaveLength(2);
    expect(input[0]?.subItems?.map((s) => s.href)).toEqual([MANDATES, '/listings/public']);
  });
});

// =============================================================================
// ΟΜΑΔΑ Μ — ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΜΕΝΟΥ, ΟΧΙ ΠΛΑΣΤΟ ΔΕΝΤΡΟ
// =============================================================================

/**
 * 🔴 **ΓΙΑΤΙ ΑΥΤΗ Η ΟΜΑΔΑ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΙΣ Π/Υ.**
 *
 * Εκείνες κρίνουν το φίλτρο πάνω σε **πλαστά** δέντρα, άρα μένουν πράσινες ακόμη κι αν
 * η συμβολοσειρά του πίνακα **δεν αντιστοιχεί σε καμία πραγματική γραμμή** — ένα
 * `'/listings/mandate'` (χωρίς `s`), ή ένα `'/o/x/listings/mandates'` με πρόθεμα χώρου,
 * θα περνούσε κάθε άλλη δοκιμή και θα ήταν **σιωπηλά ανενεργό στην παραγωγή**.
 *
 * Εδώ διαβάζεται το **αληθινό** δέντρο του `smart-navigation-factory`.
 */
describe('Μ — ο πίνακας δένει με ΠΡΑΓΜΑΤΙΚΗ γραμμή του μενού', () => {
  const realMenu = () => getMainMenuItems([]);

  /**
   * Ο παρονομαστής, και ταυτόχρονα η άγκυρα ορθογραφίας.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γράψε λάθος τη διαδρομή στον πίνακα ⇒ κόκκινο **στη Μ2**, ενώ όλες
   *    οι Π/Υ μένουν πράσινες. Αυτό ακριβώς είναι το κενό που κλείνει αυτή η ομάδα.
   */
  it('Μ1 — το πραγματικό μενού ΟΝΤΩΣ περιέχει τον κατάλογο εντολών', () => {
    expect(realMenu().map((item) => item.href)).toContain(MANDATES);
  });

  it('Μ2 — «δεν ζήτησε ποτέ»: η γραμμή φεύγει από το ΠΡΑΓΜΑΤΙΚΟ μενού', () => {
    const filtered = filterItemsByCapability(realMenu(), viewWith('unrequested'));
    expect(filtered.map((item) => item.href)).not.toContain(MANDATES);
  });

  /** Ο παρονομαστής: με `active` το πραγματικό μενού μένει **ακέραιο**. */
  it('Μ3 — «active»: το πραγματικό μενού δεν χάνει ΚΑΜΙΑ γραμμή', () => {
    const before = realMenu().map((item) => item.href);
    const after = filterItemsByCapability(realMenu(), viewWith('active')).map((i) => i.href);
    expect(after).toEqual(before);
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το φίλτρο να κόβει ό,τι δεν αναγνωρίζει ⇒ κόκκινο.
   *    Χάνεται **ένα** στοιχείο, όχι το μενού.
   */
  it('Μ4 — φεύγει ΑΚΡΙΒΩΣ μία γραμμή, όχι το μενού', () => {
    const before = realMenu().length;
    const after = filterItemsByCapability(realMenu(), viewWith('unrequested')).length;
    expect(before - after).toBe(1);
  });
});
