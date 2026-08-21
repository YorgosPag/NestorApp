/**
 * @fileoverview **Ο ΠΙΝΑΚΑΣ ΑΛΗΘΕΙΑΣ ΤΗΣ ΘΕΜΑΤΟΦΥΛΑΚΗΣ** (ADR-777 §8.39).
 * @related lib/owner-property/listing-custody.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΔΕΙΓΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η εξουσιοδότηση έχει **δύο** σφάλματα και **δεν είναι συμμετρικά**: το «αρνήθηκε σε
 * κάποιον που έπρεπε» το βλέπει ο άνθρωπος και παραπονιέται· το «**επέτρεψε σε κάποιον
 * που δεν έπρεπε**» δεν το βλέπει κανείς. Ένα test που δοκιμάζει «ο κάτοχος περνά» θα
 * ήταν πράσινο και για μια συνάρτηση που επιστρέφει **πάντα `true`**.
 *
 * Γι' αυτό εδώ απαριθμούνται **όλοι** οι συνδυασμοί των δύο χώρων × τεσσάρων ειδών
 * αιτούντος, με **ρητή** αναμενόμενη ετυμηγορία στον καθένα — και ο `Π0` αποδεικνύει
 * ότι ο πίνακας περιέχει **και τις δύο** ετυμηγορίες (αλλιώς θα επικύρωνε τον εαυτό του).
 */

import {
  custodyOf,
  isPersonalCustody,
  mayAdminister,
  type ListingActor,
  type ListingCustody,
} from '../listing-custody';

const ANNA = 'user-anna';
const BORIS = 'user-boris';
const AGENCY = 'company-agency';
const RIVAL = 'company-rival';

/** Ο ιδιώτης: γράφτηκε από την πύλη του `(me)`, όπου το `authorCompanyId` είναι πάντα `null`. */
const PERSONAL = { authorUserId: ANNA, authorCompanyId: null } as const;
/** Η εντολή: γράφτηκε από το `(app)`, με το `companyId` του `ctx` — ποτέ από το σώμα. */
const BROKERED = { authorUserId: BORIS, authorCompanyId: AGENCY } as const;

const actor = (uid: string, companyId: string | null): ListingActor => ({ uid, companyId });

describe('🔑 Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ', () => {
  it('Π0 — ο πίνακας περιέχει ΚΑΙ ΤΙΣ ΔΥΟ ετυμηγορίες', () => {
    // Χωρίς αυτό, ένας πίνακας με μόνο `true` θα ήταν πράσινος πάνω σε συνάρτηση που
    // δεν αρνείται ποτέ — δηλαδή πάνω στο μοναδικό σφάλμα που δεν βλέπει κανείς.
    const verdicts = new Set([
      mayAdminister(custodyOf(PERSONAL), actor(ANNA, null)),
      mayAdminister(custodyOf(PERSONAL), actor(BORIS, AGENCY)),
    ]);
    expect(verdicts).toEqual(new Set([true, false]));
  });

  it('Π1 — τα δύο δοχεία δίνουν ΔΙΑΦΟΡΕΤΙΚΟ είδος χώρου', () => {
    expect(custodyOf(PERSONAL).kind).toBe('personal');
    expect(custodyOf(BROKERED).kind).toBe('company');
  });
});

describe('🔴 Χ — ο χώρος παράγεται από τα δύο πεδία, ποτέ από την εντολή', () => {
  it('Χ1 — `authorCompanyId: null` ⇒ ιδιωτικός, με τον συγγραφέα του', () => {
    expect(custodyOf(PERSONAL)).toEqual({ kind: 'personal', userId: ANNA });
  });

  it('Χ2 — `authorCompanyId` παρόν ⇒ εταιρικός, και ο συγγραφέας ΔΕΝ εμφανίζεται', () => {
    // 🔑 Αυτό ΕΙΝΑΙ ο κανόνας του MLS: «listings belong to the broker, not the agent».
    // Το uid του υπαλλήλου δεν συμμετέχει καθόλου στην ετυμηγορία — γι' αυτό η αγγελία
    // επιβιώνει όταν εκείνος φύγει.
    expect(custodyOf(BROKERED)).toEqual({ kind: 'company', companyId: AGENCY });
  });
});

describe('🔴 Ε — ο πίνακας αληθείας της εξουσιοδότησης', () => {
  const CASES: ReadonlyArray<readonly [string, ListingCustody, ListingActor, boolean]> = [
    // ── ιδιωτικός χώρος: ΜΟΝΟ ο κάτοχος, ό,τι κι αν είναι αλλού ──────────────
    ['ο ίδιος ο ιδιώτης', custodyOf(PERSONAL), actor(ANNA, null), true],
    ['ο ίδιος, ακόμη κι αν ανήκει σε γραφείο', custodyOf(PERSONAL), actor(ANNA, AGENCY), true],
    ['άλλος άνθρωπος', custodyOf(PERSONAL), actor(BORIS, null), false],
    ['🔴 συνάδελφος με γραφείο — Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΔΙΕΥΡΥΝΕΤΑΙ',
      custodyOf(PERSONAL), actor(BORIS, AGENCY), false],

    // ── εταιρικός χώρος: ΟΠΟΙΟΣ είναι στο γραφείο ────────────────────────────
    ['ο μεσίτης που την κατέγραψε', custodyOf(BROKERED), actor(BORIS, AGENCY), true],
    ['🔴 ΣΥΝΑΔΕΛΦΟΣ ΤΟΥ — ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΛΕΙΣΕ', custodyOf(BROKERED), actor(ANNA, AGENCY), true],
    ['άλλο γραφείο', custodyOf(BROKERED), actor(ANNA, RIVAL), false],
    ['🔴 χρήστης ΧΩΡΙΣ εταιρεία', custodyOf(BROKERED), actor(BORIS, null), false],
  ];

  it.each(CASES)('Ε · %s', (_name, custody, who, expected) => {
    expect(mayAdminister(custody, who)).toBe(expected);
  });

  // 🔴 ΑΥΤΗ Η ΑΓΚΥΡΑ ΓΕΝΝΗΘΗΚΕ ΛΑΘΟΣ ΚΑΙ ΤΟ ΕΔΕΙΞΕ Η ΜΕΤΑΛΛΑΞΗ. Η πρώτη της μορφή
  // απαιτούσε `mayAdminister(κενό, κενό) === true` — δηλαδή **κλείδωνε** ακριβώς την
  // παγίδα που το `lib/auth/tenant-ownership.ts` προειδοποιεί: «*το κενό δεν είναι
  // tenant· είναι απουσία tenant*». Ένα test μπορεί να κάνει ένα σφάλμα **συμβόλαιο**.
  it('Ε9 — κενή εταιρεία δεν ταιριάζει με ΤΙΠΟΤΑ, ούτε με κενή', () => {
    const empty = custodyOf({ authorUserId: ANNA, authorCompanyId: '' });
    expect(empty.kind).toBe('company');
    expect(mayAdminister(empty, actor(BORIS, ''))).toBe(false);
    expect(mayAdminister(empty, actor(BORIS, null))).toBe(false);
    expect(mayAdminister(empty, actor(ANNA, AGENCY))).toBe(false);
    // …και ο συγγραφέας του δεν κερδίζει δικαίωμα από τον χώρο: ο χώρος είναι εταιρικός.
    expect(mayAdminister(empty, actor(ANNA, ''))).toBe(false);
  });

  it('Ε10 — καλών με ΚΕΝΗ εταιρεία δεν αγγίζει υπαρκτό γραφείο', () => {
    expect(mayAdminister(custodyOf(BROKERED), actor(ANNA, ''))).toBe(false);
  });
});

describe('🔴 Ι — ο ιδιωτικός χώρος του `(me)`', () => {
  it('Ι1 — η αγγελία ιδιώτη ανήκει εκεί', () => {
    expect(isPersonalCustody(PERSONAL)).toBe(true);
  });

  it('Ι2 — 🔴 η ΕΤΑΙΡΙΚΗ αγγελία ΔΕΝ ανήκει εκεί, ούτε για τον συγγραφέα της', () => {
    // Το `.shell-boundary.json` δηλώνει το `(me)` «ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΤΟΥ ΙΔΙΩΤΗ», και η
    // δήλωση είναι συμβόλαιο (CHECK 3.52). Ο κατάλογος όφειλε να το τηρεί — δεν το
    // τηρούσε, γιατί ρωτούσε `authorUserId`, δηλαδή την ερώτηση της ΑΠΟΜΟΝΩΣΗΣ.
    expect(isPersonalCustody(BROKERED)).toBe(false);
  });
});
