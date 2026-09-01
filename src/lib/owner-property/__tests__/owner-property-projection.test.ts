/**
 * @fileoverview **ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ ΤΗΣ Α14** — η προσφορά του ιδιώτη γίνεται δημόσια αγγελία.
 * @related ADR-777 §7 (Α1 · Α3 · Α5 · Α14 · Α20) · services/listings/public-listing-projection.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το handoff έθεσε το κριτήριο κατά λέξη: *«αν ένας ιδιώτης δεν μπορεί να ανεβάσει το
 * διαμέρισμά του και **να το δει να εμφανίζεται στα αποτελέσματα**, δεν έχει
 * τελειώσει»*.
 *
 * Η δημόσια οθόνη διαβάζει **αποκλειστικά** το `public_listings`, και εκεί γράφει
 * **αποκλειστικά** το `buildPublicListing`. Άρα το κριτήριο είναι **ελέγξιμο σε
 * καθαρές συναρτήσεις**: αν η μετάφραση δίνει αγγελία που το `buildPublicListing`
 * δέχεται, με **σχήμα** και **θέση**, τότε το ακίνητο **είναι** στα αποτελέσματα.
 */

import {
  ownerListingVisibility,
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '../owner-property-projection';
import {
  buildPublicListing,
  isPubliclyListed,
} from '@/services/listings/public-listing-projection';
import {
  brokeredOwnerProperty,
  offerOf,
  validOwnerProperty,
} from './owner-property-fixtures';

const AT = '2026-08-11T12:00:00.000Z';

/** Η **πλήρης** διαδρομή, όπως την εκτελεί ο γραφέας στον διακομιστή. */
function publish(property: Parameters<typeof projectableFromOwnerProperty>[0]) {
  return buildPublicListing(
    projectableFromOwnerProperty(property, AT),
    placeKnowledgeFromOwnerProperty(property, AT),
    AT,
  );
}

// =============================================================================
// Ο — ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ
// =============================================================================

describe('🔴 Ο — η προσφορά του ιδιώτη ΦΤΑΝΕΙ στα αποτελέσματα', () => {
  it('Ο1 — πλήρης αγγελία ⇒ δημοσιεύεται, με ταυτότητα το ίδιο το `ownp_*`', () => {
    const listing = publish(validOwnerProperty());

    expect(listing).not.toBeNull();
    expect(listing?.id).toBe('ownp_a');
  });

  it('Ο2 — τα «5 βασικά + 3 ειδικά» του §25.6 φτάνουν ΟΛΑ στην κάρτα', () => {
    const listing = publish(validOwnerProperty());

    expect(listing?.type).toBe('apartment');
    expect(listing?.areaSqm).toBe(92);
    expect(listing?.floor).toBe(3);
    expect(listing?.bedrooms).toBe(2);
    expect(listing?.title).toBe('Διαμέρισμα 92 τ.μ.');
    expect(listing?.offerKinds).toEqual(['sell']);
    expect(listing?.commercial.askingPrice).toBe(210_000);
    expect(listing?.position.kind).toBe('known');
  });

  it('🔑 Ο3 — η ΘΕΣΗ κουβαλά την ακρίβειά της (Α5: το σχήμα ΕΙΝΑΙ η ακρίβεια)', () => {
    const listing = publish(validOwnerProperty());

    expect(listing?.position).toEqual({
      kind: 'known',
      provenance: 'geocoded',
      point: { lat: 40.63, lng: 22.95 },
      locatedAt: AT,
      accuracy: 'exact',
    });
  });

  it('Ο4 — σημείο ΧΩΡΙΣ ακρίβεια ⇒ προέλευση `manual`, ποτέ ψεύτικο `center`', () => {
    const listing = publish(
      validOwnerProperty({
        place: {
          kind: 'declared',
          point: { lat: 40.1, lng: 22.1 },
          label: 'κάπου',
          accuracy: null,
          link: null,
        },
      }),
    );

    expect(listing?.position).toMatchObject({ kind: 'known', provenance: 'manual' });
  });
});

// =============================================================================
// Θ — Η ΘΕΣΗ ΠΟΥ ΔΕΝ ΔΗΛΩΘΗΚΕ — ο γραφέας που «δεν υπήρχε»
// =============================================================================

describe('🔑 Θ — «υποχρεωτικό ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ» (Α5 §3)', () => {
  it('Θ1 — άρνηση θέσης ⇒ ΔΗΜΟΣΙΕΥΕΤΑΙ, με λόγο `owner-declined`', () => {
    const listing = publish(validOwnerProperty({ place: { kind: 'declined' } }));

    // Η αγγελία **δεν εξαφανίζεται** — μπαίνει στον μετρητή των «χωρίς θέση» (Α5 §4.1).
    expect(listing).not.toBeNull();
    expect(listing?.position).toEqual({ kind: 'unknown', reason: 'owner-declined' });
  });

  /**
   * 🔴 **Η διάκριση που ήταν ΜΗ ΠΑΡΑΤΗΡΗΣΙΜΗ μέχρι σήμερα.**
   *
   * Το `public-listing-projection.ts` δηλώνει ότι *«κανένας γραφέας δεν υπάρχει
   * σήμερα»* για το `locationDisclosure`. Αυτή η δοκιμή είναι η απόδειξη ότι πλέον
   * υπάρχει: **δύο** ακίνητα χωρίς συντεταγμένες δίνουν **διαφορετικό** λόγο, ανάλογα
   * με το αν ο άνθρωπος **ρωτήθηκε και είπε όχι**.
   */
  it('🔴 Θ2 — «ρωτήθηκε και δεν είπε» ΞΕΧΩΡΙΖΕΙ από «δεν ρωτήθηκε ποτέ»', () => {
    const declined = publish(validOwnerProperty({ place: { kind: 'declined' } }));

    // Ο παρονομαστής: το **παλιό** ακίνητο (χωρίς `locationDisclosure`) — η κατάσταση
    // κάθε εγγράφου που γράφτηκε πριν υπάρξει το ερώτημα.
    const neverAsked = buildPublicListing(
      { ...projectableFromOwnerProperty(validOwnerProperty(), AT), locationDisclosure: null },
      { candidates: [], ref: null },
      AT,
    );

    expect(declined?.position).toEqual({ kind: 'unknown', reason: 'owner-declined' });
    expect(neverAsked?.position).toEqual({ kind: 'unknown', reason: 'never-asked' });
  });
});

// =============================================================================
// Α — Η ΑΠΟΣΥΡΣΗ ΣΥΜΒΑΙΝΕΙ
// =============================================================================

describe('Α — η απόσυρση εκφράζεται ως «καμία διάθεση», όχι ως δεύτερο κριτήριο', () => {
  it('Α1 — αποσυρμένη αγγελία ⇒ `null` ⇒ ο γραφέας ΣΒΗΝΕΙ τη δημόσια προβολή', () => {
    expect(publish(validOwnerProperty({ lifecycle: 'withdrawn' }))).toBeNull();
  });

  it('Α2 — και επιστρέφει ΑΥΤΟΥΣΙΑ με την επαναφορά (καμία απώλεια)', () => {
    const property = validOwnerProperty({ lifecycle: 'withdrawn' });
    const back = publish({ ...property, lifecycle: 'listed' });

    expect(back).not.toBeNull();
    expect(back?.commercial.askingPrice).toBe(210_000);
  });
});

// =============================================================================
// Π — ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΕΘΗΚΕ ΜΕΤΡΩΝΤΑΣ (2026-08-11)
// =============================================================================

/**
 * 🔴 **Η Α14 είναι η πρώτη που γράφει πραγματικά `offerKinds` στην παραγωγή.**
 *
 * Το `LIVE_OFFER_LIFECYCLES` περιλαμβάνει **σκόπιμα** το `closed` (έτσι παράγεται το
 * `sold`), οπότε το `deriveOfferKinds` μιας πουλημένης μονάδας επιστρέφει `['sell']`
 * — και το δεύτερο σκέλος του `isPubliclyListed` θα το κρατούσε **στην αγορά**.
 *
 * Το ελάττωμα ήταν **λανθάνον** (κανένα σημερινό έγγραφο δεν έχει `offerKinds`) και
 * η Α14 θα ήταν το **πρώτο** που το ζωντάνευε.
 */
describe('🔴 Π — πουλημένο ΔΕΝ μένει στην αγορά', () => {
  it('Π1 — κλεισμένη πώληση ⇒ ΔΕΝ δημοσιεύεται', () => {
    const sold = validOwnerProperty({
      offers: [offerOf('sell', 210_000, 'closed')],
    });

    // Ο παρονομαστής: το `offerKinds` **όντως** περιέχει `sell` (το `closed` είναι
    // «ζωντανό» για την παραγωγή κατάστασης) — άρα το σκέλος **δοκιμάζεται**.
    const projectable = projectableFromOwnerProperty(sold, AT);
    expect(projectable.offerKinds).toEqual(['sell']);
    expect(projectable.commercialStatus).toBe('sold');

    expect(isPubliclyListed(projectable)).toBe(false);
    expect(publish(sold)).toBeNull();
  });

  it('Π2 — και το ίδιο για ενοικιασμένο', () => {
    const rented = validOwnerProperty({ offers: [offerOf('leaseOut', 800, 'closed')] });
    expect(publish(rented)).toBeNull();
  });

  it('🔑 Π3 — η ΑΝΤΙΠΑΡΟΧΗ δημοσιεύεται, παρότι προβάλλεται σε `unavailable`', () => {
    const exchange = validOwnerProperty({ offers: [offerOf('exchange', 45)] });
    const projectable = projectableFromOwnerProperty(exchange, AT);

    // Το παλιό λεξιλόγιο **δεν έχει λέξη** γι' αυτήν…
    expect(projectable.commercialStatus).toBe('unavailable');
    // …και ο νέος άξονας την κρατά ορατή. Αυτό είναι ολόκληρη η Α20.
    expect(publish(exchange)?.offerKinds).toEqual(['exchange']);
  });

  it('Π4 — κρατημένο (`reserved`) ΠΑΡΑΜΕΝΕΙ ορατό — δεν είναι τελική κατάσταση', () => {
    const reserved = validOwnerProperty({ offers: [offerOf('sell', 210_000, 'reserved')] });
    expect(publish(reserved)).not.toBeNull();
  });
});

// =============================================================================
// Ι — Ο,ΤΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΦΥΓΕΙ
// =============================================================================

describe('🔴 Ι — το ιδιωτικό ΔΕΝ ταξιδεύει στη δημόσια αγγελία', () => {
  it('Ι1 — καμία διεύθυνση, κανένα αρχείο, καμία ταυτότητα κατόχου', () => {
    const listing = publish(validOwnerProperty());
    const flat = JSON.stringify(listing);

    expect(flat).not.toContain('Εγνατίας');
    expect(flat).not.toContain('katopsi.pdf');
    expect(flat).not.toContain('user-1');
  });

  it('🔑 Ι2 — και η εικόνα μένει `null`: κανόνας 31 (Α19) — ποτέ ανέβασμα χρήστη', () => {
    // Ο ιδιοκτήτης **έχει** ανεβάσει αρχείο (`SAMPLE_MEDIA` στο fixture), και παρ' όλα
    // αυτά η κάρτα δεν το δείχνει. Είναι δέσμευση, όχι παράλειψη.
    expect(validOwnerProperty().media).toHaveLength(1);
    expect(publish(validOwnerProperty())?.coverImage).toBeNull();
  });

  it('🔴 Ι3 — ΚΑΙ ΤΟ ΡΑΦΙ ΜΕΝΕΙ ΑΔΕΙΟ ΟΣΟ ΔΕΝ ΤΟ ΕΙΠΕ Ο ΑΝΘΡΩΠΟΣ (ADR-841 §7 Α2.7)', () => {
    // Το ίδιο αρχείο, η ίδια διαδρομή γραφέα — και **καμία πηγή** στο ράφι, γιατί
    // κανείς δεν πάτησε «δημοσίευση». Αυτή είναι η **ολόκληρη** διαδρομή, όχι το
    // `filter` απομονωμένο: αν κάποιος αφαιρέσει το κριτήριο από τη μία ή την άλλη
    // πλευρά, η φωτογραφία του κατόχου βγαίνει στον κόσμο **χωρίς πράξη του**.
    const projected = projectableFromOwnerProperty(validOwnerProperty(), AT);

    expect(validOwnerProperty().media).toHaveLength(1);
    expect(projected.publishedMedia).toEqual([]);
  });

  it('🔑 Ι4 — με ρητή επιλογή, ΚΑΙ ΤΟΤΕ ΜΟΝΟ, το μονοπάτι φτάνει στο ράφι', () => {
    const property = validOwnerProperty();
    const chosen = {
      ...property,
      media: property.media.map((item) => ({ ...item, published: true })),
    };

    expect(projectableFromOwnerProperty(chosen, AT).publishedMedia).toEqual([
      { privateStoragePath: property.media[0].storagePath },
    ]);
  });
});


// =============================================================================
// Μ — Η ΕΝΤΟΛΗ ΤΟΥ ΜΕΣΙΤΗ (§8.33)
// =============================================================================

/**
 * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΜΕΤΡΑΕΙ: η δημοσίευση χωρίς έγκριση είναι ΔΟΜΙΚΑ ΑΔΥΝΑΤΗ.**
 *
 * Δεν ελέγχεται εδώ κάποιο `boolean` — εκτελείται η **πλήρης** διαδρομή του γραφέα
 * (`projectable → buildPublicListing`), η ίδια που τρέχει ο διακομιστής. Ένας έλεγχος
 * πάνω στο `mandateAllowsPublication` θα ήταν πράσινος ακόμη κι αν κανείς δεν τον
 * καλούσε — ακριβώς το «φρουρός χωρίς απόδειξη ζωής» που το §8.33 ήρθε να κλείσει.
 */
describe('🔴 Μ — καμία αγγελία γραφείου στον κόσμο χωρίς «ναι» του ιδιοκτήτη', () => {
  it('🔑 Μ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΙΔΙΑ αγγελία ως ΙΔΙΩΤΗ δημοσιεύεται', () => {
    expect(publish(validOwnerProperty())).not.toBeNull();
  });

  it('🔴 Μ2 — εντολή σε ΑΝΑΜΟΝΗ: το `buildPublicListing` γυρίζει `null`', () => {
    expect(publish(brokeredOwnerProperty())).toBeNull();
  });

  it('Μ3 — μόλις ο ιδιοκτήτης πει «ναι», η ΙΔΙΑ αγγελία βγαίνει στον χάρτη', () => {
    const confirmed = brokeredOwnerProperty({
      confirmation: 'confirmed',
      decidedAt: AT,
    });
    expect(publish(confirmed)).not.toBeNull();
  });

  it('🔴 Μ4 — ΛΗΓΜΕΝΗ εντολή φεύγει από τον χάρτη ΧΩΡΙΣ κανέναν νέο μηχανισμό', () => {
    const expired = brokeredOwnerProperty({
      confirmation: 'confirmed',
      decidedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-08-01T00:00:00.000Z', // πριν από το AT
    });

    // Ο παρονομαστής: η **έγκριση υπάρχει** — άρα το `null` οφείλεται στη λήξη και
    // μόνο σε αυτήν.
    expect(expired.mandates).toHaveLength(1);
    expect(publish(expired)).toBeNull();

    // ⚠️ Και το έγγραφο **δεν άλλαξε**: η αγγελία εξαφανίζεται από τον κόσμο, ο
    // κατάλογος του γραφείου την κρατά. Είναι η υπόσχεση «λήγει, δεν σβήνει».
    expect(expired.lifecycle).toBe('listed');
    expect(expired.offers).toHaveLength(1);
  });

  it('Μ5 — ΑΡΝΗΣΗ του ιδιοκτήτη: εξίσου εκτός χάρτη', () => {
    expect(
      publish(brokeredOwnerProperty({ confirmation: 'declined', decidedAt: AT })),
    ).toBeNull();
  });

  /**
   * 🔴 **ΔΙΟΡΘΩΘΗΚΕ, ΔΕΝ ΧΑΛΑΡΩΣΕ (ADR-841 §7 Α1, 2026-09-01).** Εδώ έγραφε *«καμία
   * ταυτότητα **του γραφείου** δεν διαρρέει»* — και ήταν πράσινο για **λάθος λόγο**:
   * το `publish()` δεν περνά ταυτότητα, οπότε η άγκυρα μετρούσε την **προεπιλογή**,
   * όχι τη ζωντανή διαδρομή. Από σήμερα η ταυτότητα του γραφείου **δημοσιεύεται
   * επίτηδες** *(δες `Υ3`)*, άρα η παλιά διατύπωση θα ήταν **δεύτερη αλήθεια** —
   * άγκυρα που λέει το αντίθετο από τον κώδικα, πράσινη επειδή κοιτά αλλού.
   *
   * 🔑 Αυτό που μένει αληθινό και **αξίζει** άγκυρα είναι **δύο** πράγματα:
   * 1. η ταυτότητα του **ΠΕΛΑΤΗ** δεν φεύγει **ποτέ** *(εκείνος δεν διάλεξε να φανεί)*·
   * 2. αυτό το αρχείο είναι **leaf**: **δεν εφευρίσκει** ταυτότητα γραφείου — αν δεν
   *    του τη δώσει ο καλών, δεν υπάρχει. Έτσι η ανάγνωση εταιρείας μένει **έξω** από
   *    μια συνάρτηση που λέγεται «μετάφραση».
   */
  it('🔑 Μ6 — ο ΠΕΛΑΤΗΣ δεν διαρρέει ποτέ, και η μετάφραση ΔΕΝ ΕΦΕΥΡΙΣΚΕΙ γραφείο', () => {
    const confirmed = brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT });
    const flat = JSON.stringify(publish(confirmed));

    // 1) Ο πελάτης — **απόλυτο**, καμία απόφαση δεν το ανατρέπει.
    expect(flat).not.toContain('cont_kostas');
    // 2) Χωρίς ταυτότητα από τον καλούντα, το leaf δεν βγάζει καμία από το πουθενά —
    //    παρότι το `authorCompanyId: 'comp_alfa'` κάθεται μέσα στο έγγραφο εισόδου.
    expect(confirmed.authorCompanyId).toBe('comp_alfa');
    expect(flat).not.toContain('comp_alfa');
  });
});


// =============================================================================
// Υ — Η ΥΠΟΓΡΑΦΗ ΦΤΑΝΕΙ ΑΠΟ ΤΗΝ ΕΝΤΟΛΗ ΣΤΟΝ ΚΟΣΜΟ (§8.33)
// =============================================================================

/**
 * 🔴 **ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ ΓΕΝΝΗΘΗΚΑΝ ΑΠΟ ΔΥΟ ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΕΠΕΖΗΣΑΝ.**
 *
 * Οι άγκυρες `Υ1`-`Υ3` του `public-listing-projection.test.ts` κρίνουν το
 * `buildPublicListing` με **χειροποίητη** είσοδο — αποδεικνύουν ότι η μηχανή κουβαλά
 * ό,τι της δώσεις. **Δεν** αποδεικνύουν ότι κάποιος της δίνει το σωστό.
 *
 * Μετρημένο: με `authorship: 'owner-declared'` καρφωμένο στη μετάφραση, και με το
 * `agencyName` σβησμένο, **όλη η σουίτα έμενε πράσινη**. Δηλαδή το πεδίο μπορούσε να
 * λέει ψέματα για κάθε αγγελία γραφείου και κανείς δεν θα το μάθαινε.
 */
/** Η ταυτότητα του γραφείου ως **ζεύγος** (ADR-841 §7 Α1.6) — ποτέ σκέτο όνομα. */
const ALFA = { id: 'comp_alfa', name: 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ' } as const;

describe('🔴 Υ — ο επισκέπτης μαθαίνει ΠΟΙΟΣ δημοσίευσε, μέσα από τη ΜΕΤΑΦΡΑΣΗ', () => {
  it('🔑 Υ1 — αγγελία ΙΔΙΩΤΗ ⇒ `owner-declared`, καμία επωνυμία', () => {
    const listing = publish(validOwnerProperty())!;
    expect(listing.authorship).toBe('owner-declared');
    expect(listing.agencyName).toBeNull();
    expect(listing.agencyId).toBeNull();
  });

  it('🔴 Υ2 — αγγελία ΓΡΑΦΕΙΟΥ ⇒ `agency`, ΜΕΣΑ ΑΠΟ ΤΗΝ ΕΝΤΟΛΗ', () => {
    const confirmed = brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT });
    const projectable = projectableFromOwnerProperty(confirmed, AT, ALFA);

    // Ο παρονομαστής: η **ίδια** αγγελία ως ιδιώτη δίνει την άλλη τιμή. Χωρίς αυτό,
    // ένα καρφωμένο `'agency'` θα ήταν εξίσου πράσινο.
    expect(projectableFromOwnerProperty(validOwnerProperty(), AT).authorship).toBe(
      'owner-declared',
    );
    expect(projectable.authorship).toBe('agency');
    expect(projectable.agency).toEqual(ALFA);
  });

  it('🔴 Υ3 — η επωνυμία ταξιδεύει ΩΣ ΤΗ ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ, όχι μόνο ως το ενδιάμεσο', () => {
    const confirmed = brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT });
    const listing = buildPublicListing(
      projectableFromOwnerProperty(confirmed, AT, ALFA),
      placeKnowledgeFromOwnerProperty(confirmed, AT),
      AT,
    );

    expect(listing).not.toBeNull();
    expect(listing?.authorship).toBe('agency');
    expect(listing?.agencyName).toBe('ΑΛΦΑ ΜΕΣΙΤΙΚΗ');
    // ADR-841 §7 (Α1.6): και η **ταυτότητα** ταξιδεύει — αλλιώς το αντίγραφο της
    // επωνυμίας δεν μπορεί ποτέ να επαληθευτεί ούτε να επισκευαστεί.
    expect(listing?.agencyId).toBe('comp_alfa');
  });

  it('🔑 Υ4 — γραφείο ΧΩΡΙΣ γνωστή επωνυμία μένει «γραφείο», δεν γίνεται «ιδιώτης»', () => {
    // Τα δύο πεδία **δεν συμπτύσσονται**: μια αγγελία γραφείου του οποίου η επωνυμία
    // δεν διαβάστηκε είναι **ακόμη** αγγελία γραφείου. Η οθόνη έχει τρίτο κείμενο
    // ακριβώς γι' αυτό.
    const confirmed = brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT });
    const projectable = projectableFromOwnerProperty(confirmed, AT, {
      id: 'comp_alfa',
      name: null,
    });
    expect(projectable.authorship).toBe('agency');
    expect(projectable.agency?.name).toBeNull();
    // 🔑 Και η **ταυτότητα επιζεί**: είναι η μόνη ένδειξη ποιον να ξαναρωτήσουμε.
    expect(projectable.agency?.id).toBe('comp_alfa');
  });
});


// =============================================================================
// Ο — Η ΟΘΟΝΗ ΤΟΥ ΚΑΤΟΧΟΥ ΔΕΝ ΛΕΕΙ «ΣΤΟΝ ΧΑΡΤΗ» ΟΤΑΝ Η ΓΡΑΦΗ ΕΙΠΕ ΑΛΛΟ
// =============================================================================

describe('🔴 Φ — «δικαιούται» ≠ «έφτασε»: το γεγονός νικά την πρόβλεψη', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΨΕΜΑΤΟΣ ΤΗΣ ΟΘΟΝΗΣ.**
   *
   * Μέχρι τις 2026-08-27 η κάρτα έλεγε «*Η αγγελία είναι στον δημόσιο χάρτη*» με
   * απόλυτη βεβαιότητα σε **ακριβώς** αυτή την περίπτωση — αγγελία που **δικαιούται**
   * και της οποίας η προβολή **απέτυχε** — γιατί έκρινε μόνο με την καθαρή συνάρτηση.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε τον κλάδο `publication?.outcome === 'failed'` ⇒ **κόκκινο**.
   */
  it('αποτυχία δημοσίευσης ⇒ «failed», ΟΧΙ «published»', () => {
    const property = validOwnerProperty({
      publication: { outcome: 'failed', at: AT },
    });

    // ✅ Ο παρονομαστής **μέσα** στην ίδια δοκιμή: η αγγελία **δικαιούται** — άρα η
    //    διαφορά προέρχεται αποκλειστικά από το αποτύπωμα, όχι από άκυρη οντότητα.
    expect(isPubliclyListed(projectableFromOwnerProperty(property, AT))).toBe(true);
    expect(ownerListingVisibility(property, AT)).toBe('failed');
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΣΙΩΠΗΣ.** Κάθε αγγελία που υπάρχει σήμερα στη βάση
   * **δεν έχει** αποτύπωμα. Αν η απουσία διαβαζόταν ως αποτυχία, **ολόκληρη** η
   * σημερινή βάση θα εμφανιζόταν εκκρεμής.
   */
  it('χωρίς αποτύπωμα ⇒ κρίνει η καθαρή συνάρτηση', () => {
    expect(validOwnerProperty().publication).toBeUndefined();
    expect(ownerListingVisibility(validOwnerProperty(), AT)).toBe('published');
  });

  /**
   * 🔑 **Μπαγιάτικο «published» ΔΕΝ υπερισχύει.** Το αποτύπωμα λέει τι έγινε **τότε**·
   * η οντότητα λέει τι δικαιούται **τώρα**. Μια αγγελία που αποσύρθηκε μετά από
   * επιτυχή δημοσίευση **δεν** είναι στον χάρτη.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε το αποτύπωμα να επιστρέφεται πάντα (`return
   * property.publication.outcome`) ⇒ **κόκκινο**.
   */
  it('παλιό «published» δεν κρύβει την τωρινή απόσυρση', () => {
    const withdrawn = validOwnerProperty({
      offers: [offerOf('sell', 210_000, 'withdrawn')],
      publication: { outcome: 'published', at: AT },
    });

    expect(ownerListingVisibility(withdrawn, AT)).toBe('withdrawn');
  });

  /** Και τα τρία σκέλη έχουν **γραμμένο** κλειδί i18n — `offer.publish.<σκέλος>`. */
  it('το λεξιλόγιο είναι το ΥΠΑΡΧΟΝ `PublishOutcome`, καμία νέα λέξη', () => {
    const outcomes = new Set([
      ownerListingVisibility(validOwnerProperty(), AT),
      ownerListingVisibility(
        validOwnerProperty({ offers: [offerOf('sell', 210_000, 'withdrawn')] }),
        AT,
      ),
      ownerListingVisibility(
        validOwnerProperty({ publication: { outcome: 'failed', at: AT } }),
        AT,
      ),
    ]);

    expect([...outcomes].sort()).toEqual(['failed', 'published', 'withdrawn']);
  });
});
