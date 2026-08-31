/**
 * @fileoverview 🔴 **Η ΥΠΟΣΧΕΣΗ ΤΗΣ ΟΘΟΝΗΣ ΕΙΝΑΙ ΑΛΗΘΙΝΗ ΓΙΑ ΤΟΝ ΚΩΔΙΚΑ ΔΙΠΛΑ ΤΗΣ;**
 * @related ADR-834 §6.4.β · components/mandate/listing-eligibility.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ ΟΤΙ Η ΠΡΟΤΑΣΗ **ΠΑΡΑΓΕΤΑΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `listing-eligibility` κάνει τη λίστα της πρότασης **παράγωγο** του φίλτρου, άρα
 * η απόκλιση *«η πρόταση αναφέρει κριτήριο που δεν εκτελείται»* έγινε δομικά αδύνατη.
 * **Δύο ψέματα επιβιώνουν όμως της παραγωγής**, και τα πιάνει μόνο εκτέλεση:
 *
 *   1. **Ψέμα διακόσμησης** — ένα κριτήριο μπαίνει στον πίνακα, γράφεται στην πρόταση,
 *      αλλά το `holds` του δεν απορρίπτει **τίποτε** (αδρανής φρουρός, ADR-749 §5:
 *      **606** μετρημένοι). Η οθόνη υπόσχεται φίλτρο που δεν φιλτράρει.
 *   2. 🔑 **ΨΕΜΑ ΠΑΡΑΛΕΙΨΗΣ, ΤΟ ΧΕΙΡΟΤΕΡΟ** — η πρόταση λέει *«εμφανίζονται **ΜΟΝΟ**
 *      ακίνητα …»*, δηλαδή είναι **ισχυρισμός επάρκειας**: *ό,τι πληροί τα κριτήρια,
 *      φαίνεται*. Ένα κρυφό φίλτρο αλλού στην αλυσίδα την κάνει ψεύτικη **χωρίς να
 *      αγγίξει ούτε μία λέξη της** — ακριβώς το σχήμα που έζησε ο άνθρωπος (§6.4.β).
 *
 * ⚠️ **ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΣΥΓΚΡΙΝΕΙ ΠΟΤΕ ΚΕΙΜΕΝΟ ΜΕ ΚΕΙΜΕΝΟ.** Ένα
 * `expect(t('listingHint')).toBe(el.listingHint)` **επιζεί κάθε μετάλλαξης** και δίνει
 * πράσινο πάνω σε ψέμα — είναι **χειρότερο από καμία άγκυρα**. Εδώ εκτελείται το
 * **κατηγόρημα**· το ότι οι λέξεις υπάρχουν σε δύο γλώσσες το φυλά το
 * `mandate-request-labels.test.ts`.
 */

import {
  LISTING_ELIGIBILITY_CRITERIA,
  LISTING_ELIGIBILITY_I18N_KEYS,
  assignableListings,
  listingEligibilityHint,
} from '@/components/mandate/listing-eligibility';
import {
  brokeredOwnerProperty,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  LIVE_OWNER_PROPERTY_LIFECYCLES,
  OWNER_PROPERTY_LIFECYCLES,
  type OwnerProperty,
} from '@/types/owner-property';

/** Ό,τι περνά **κάθε** κριτήριο — ο παρονομαστής όλων των παρακάτω. */
const ELIGIBLE: OwnerProperty = validOwnerProperty({ id: 'ownp_ok' });

/**
 * **Ένα ακίνητο που αποτυγχάνει σε ΑΚΡΙΒΩΣ ΕΝΑ κριτήριο**, ονομαστικά.
 *
 * ⚠️ Η ίδια η συνάρτηση **επαληθεύεται** από το Α0: αν χαλάσει και επιστρέψει κάτι
 * που περνά τα πάντα, όλοι οι έλεγχοι αναγκαιότητας θα γίνονταν σιωπηλά κενοί.
 */
function failingOnly(id: string): OwnerProperty {
  switch (id) {
    // Εταιρικός χώρος: `authorCompanyId` **όχι** `null` ⇒ ο `custodyOf` λέει `company`.
    case 'personalCustody':
      return validOwnerProperty({ id: 'ownp_company', authorCompanyId: 'company-agency' });
    case 'live':
      return validOwnerProperty({ id: 'ownp_withdrawn', lifecycle: 'withdrawn' });
    default:
      throw new Error(`Κριτήριο χωρίς αντίδειγμα: ${id}`);
  }
}

// ============================================================================
// Α — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ============================================================================

describe('🔑 Α — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχει κάτι να φιλτραριστεί', () => {
  it('Α0 — το πλήρες ακίνητο ΠΕΡΝΑ, και κάθε αντίδειγμα ΚΟΒΕΤΑΙ', () => {
    // Χωρίς αυτό, ένας `assignableListings` που επιστρέφει **πάντα** κενό θα ήταν
    // πράσινος σε κάθε έλεγχο αναγκαιότητας παρακάτω.
    expect(assignableListings([ELIGIBLE])).toEqual([ELIGIBLE]);

    const verdicts = new Set(
      LISTING_ELIGIBILITY_CRITERIA.map(
        (criterion) => assignableListings([failingOnly(criterion.id)]).length,
      ),
    );
    expect(verdicts).toEqual(new Set([0]));
  });

  it('Α1 — ο πίνακας ΔΕΝ είναι κενός, και κάθε γραμμή έχει ΚΑΙ κατηγόρημα ΚΑΙ λέξεις', () => {
    expect(LISTING_ELIGIBILITY_CRITERIA.length).toBeGreaterThan(0);

    const broken = LISTING_ELIGIBILITY_CRITERIA.filter(
      (criterion) =>
        typeof criterion.holds !== 'function' ||
        typeof criterion.labelKey !== 'string' ||
        criterion.labelKey.trim() === '',
    ).map((criterion) => criterion.id);
    expect(broken).toEqual([]);
  });

  it('Α2 — κάθε κριτήριο έχει ΔΙΚΟ του αναγνωριστικό και ΔΙΚΟ του κλειδί', () => {
    const ids = LISTING_ELIGIBILITY_CRITERIA.map((criterion) => criterion.id);
    const keys = LISTING_ELIGIBILITY_CRITERIA.map((criterion) => criterion.labelKey);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.keys(LISTING_ELIGIBILITY_I18N_KEYS).sort()).toEqual([...ids].sort());
  });
});

// ============================================================================
// Β — ΑΝΑΓΚΑΙΟΤΗΤΑ: ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΦΕΡΕΙ ΒΑΡΟΣ
// ============================================================================

describe('🔴 Β — κανένα κριτήριο της πρότασης δεν είναι διακόσμηση', () => {
  it.each(LISTING_ELIGIBILITY_CRITERIA.map((criterion) => [criterion.id] as const))(
    'Β1 · %s — υπάρχει ακίνητο που ΜΟΝΟ αυτό το κόβει',
    (id) => {
      const victim = failingOnly(id);
      const criterion = LISTING_ELIGIBILITY_CRITERIA.find((entry) => entry.id === id);

      // (α) Το κατηγόρημα **αυτού** του κριτηρίου το απορρίπτει…
      expect(criterion?.holds(victim)).toBe(false);

      // (β) …ενώ **κάθε άλλο** το δέχεται ⇒ το αντίδειγμα είναι όντως μονο-παραγοντικό,
      //     άρα η απόρριψη του (γ) δεν μπορεί να οφείλεται σε κανένα άλλο κριτήριο.
      const otherRejections = LISTING_ELIGIBILITY_CRITERIA.filter(
        (entry) => entry.id !== id && !entry.holds(victim),
      ).map((entry) => entry.id);
      expect(otherRejections).toEqual([]);

      // (γ) …και ο **πραγματικός** επιλογέας το κόβει. Αν αφαιρεθεί η γραμμή από τον
      //     πίνακα, αυτό εδώ κοκκινίζει — και μαζί του φεύγει η λέξη από την πρόταση.
      expect(assignableListings([ELIGIBLE, victim])).toEqual([ELIGIBLE]);
    },
  );
});

// ============================================================================
// Γ — ΕΠΑΡΚΕΙΑ: ΤΟ «ΜΟΝΟ» ΤΗΣ ΠΡΟΤΑΣΗΣ ΔΕΝ ΨΕΥΔΕΤΑΙ ΜΕ ΠΑΡΑΛΕΙΨΗ
// ============================================================================

describe('🔴 Γ — δεν υπάρχει κριτήριο που εκτελείται ΧΩΡΙΣ να ειπωθεί', () => {
  it('Γ1 — ακίνητο που πληροί ΚΑΘΕ δηλωμένο κριτήριο ΕΜΦΑΝΙΖΕΤΑΙ', () => {
    // 🔑 **Ο ισχυρισμός επάρκειας, εκτελεσμένος.** Ένα κρυφό φίλτρο μέσα στον
    //    `assignableListings` — π.χ. επαναφορά του «καμία εντολή» που το ADR-832
    //    αφαίρεσε — κοκκινίζει **εδώ**, χωρίς να αγγίξει λέξη της πρότασης.
    const declared = LISTING_ELIGIBILITY_CRITERIA.every((criterion) =>
      criterion.holds(ELIGIBLE),
    );
    expect(declared).toBe(true);
    expect(assignableListings([ELIGIBLE])).toEqual([ELIGIBLE]);
  });

  it('🔴 Γ2 — ακίνητο ΜΕ ΕΝΤΟΛΗ εξακολουθεί να εμφανίζεται (η απόφαση του ADR-832)', () => {
    // ⚠️ Αυτή η γραμμή είναι **φρουρός παλινδρόμησης με τεκμηριωμένο θύμα**: όποιος
    //    ξαναβάλει τον έλεγχο εντολής στον επιλογέα «για να ταιριάξει με το κείμενο»
    //    ξαναφέρνει το *«ο ιδιοκτήτης δεν μάθαινε ποτέ γιατί λείπει το σπίτι του»*.
    //    Ο κριτής της σύγκρουσης θέλει τους **όρους** — τους κρίνει ο διακομιστής.
    // ⚠️ `authorCompanyId: null` **επίτηδες**: το ζωντανό «TEST» είναι αγγελία του
    //    ιδιώτη (ιδιωτικός χώρος) που κρατά εντολή προς γραφείο — όχι εταιρική
    //    αγγελία. Η προεπιλογή του χτίστη είναι εταιρική, και θα έκοβε το ακίνητο
    //    για **άλλο** λόγο, κάνοντας τη γραμμή πράσινη χωρίς να αποδεικνύει τίποτα.
    const brokered = brokeredOwnerProperty(
      { confirmation: 'confirmed' },
      { id: 'ownp_brokered', authorCompanyId: null },
    );
    expect(assignableListings([brokered]).map((property) => property.id)).toEqual([
      'ownp_brokered',
    ]);
  });
});

// ============================================================================
// Δ — Η ΠΡΟΤΑΣΗ ΠΑΡΑΓΕΤΑΙ ΑΠΟ ΤΟΝ ΙΔΙΟ ΠΙΝΑΚΑ
// ============================================================================

describe('🏆 Δ — η υπόσχεση γράφεται από το φίλτρο, όχι δίπλα του', () => {
  /**
   * Μεταφραστής-καθρέφτης: επιστρέφει το **κλειδί** και, όταν υπάρχουν, τις τιμές που
   * θα ενίονταν σε αυτό.
   *
   * ⚠️ **Δεν διαβάζει locale επίτηδες.** Αν διάβαζε, η άγκυρα θα εξαρτιόταν από τη
   * διατύπωση της πρότασης — δηλαδή θα κοκκίνιζε σε **αλλαγή λέξης** και θα έμενε
   * πράσινη σε αλλαγή **κριτηρίου**, ακριβώς ανάποδα από ό,τι πρέπει.
   */
  const echo = (key: string, values?: Record<string, string>): string =>
    values === undefined
      ? key
      : `${key}(${Object.entries(values)
          .map(([name, value]) => `${name}=${value}`)
          .join(',')})`;

  const join = (parts: readonly string[]): string => parts.join(' + ');

  it('Δ1 — ΚΑΘΕ κριτήριο του πίνακα φτάνει στην πρόταση', () => {
    const hint = listingEligibilityHint(echo, join);
    const missing = LISTING_ELIGIBILITY_CRITERIA.filter(
      (criterion) => !hint.includes(criterion.labelKey),
    ).map((criterion) => criterion.id);
    expect(missing).toEqual([]);
  });

  it('🔑 Δ2 — και ΤΙΠΟΤΕ ΑΛΛΟ: η λίστα έχει ΑΚΡΙΒΩΣ τόσα μέλη όσα ο πίνακας', () => {
    // Χωρίς αυτό, ένα χειρόγραφο θραύσμα κολλημένο στο πρότυπο θα περνούσε το Δ1.
    const seen: string[][] = [];
    listingEligibilityHint(echo, (parts) => {
      seen.push([...parts]);
      return parts.join(' + ');
    });
    expect(seen).toEqual([LISTING_ELIGIBILITY_CRITERIA.map((c) => c.labelKey)]);
  });

  it('Δ3 — ο συνδετήρας ΔΕΝ είναι γραμμένος στην πρόταση (τον ξέρει το Intl)', () => {
    // Το `{criteria}` πρέπει να είναι **ένα** σημείο ένθεσης· δύο θέσεις θα σήμαιναν
    // ότι κάποιος έσπασε τη λίστα σε συνενωμένα θραύσματα (το «word order problem»).
    const template = listingEligibilityHint((key) => key, join);
    expect(template).toContain('listingHint');
  });
});

// ============================================================================
// Ε — ΤΟ ΔΕΥΤΕΡΟ ΣΚΕΛΟΣ ΤΗΣ ΠΡΟΤΑΣΗΣ: «ΑΝ ΛΕΙΠΕΙ ΚΑΠΟΙΟ, ΕΙΝΑΙ ΑΠΟΣΥΡΜΕΝΟ»
// ============================================================================

describe('🔴 Ε — το «είναι αποσυρμένο» είναι ΕΞΑΝΤΛΗΤΙΚΟ, όχι πιθανό', () => {
  it('Ε1 — ο μόνος μη-ζωντανός κύκλος ζωής είναι το `withdrawn`', () => {
    // 🔑 Η πρόταση λέει στον άνθρωπο **γιατί** λείπει το σπίτι του — ακριβώς το
    //    παράπονο που γέννησε το ADR-832. Είναι αληθής **μόνο** όσο το συμπλήρωμα των
    //    ζωντανών καταστάσεων είναι το `withdrawn` και **τίποτε άλλο**. Τρίτος κύκλος
    //    ζωής αύριο ⇒ η πρόταση γίνεται ψευδής, και το μαθαίνουμε **εδώ**.
    const notLive = OWNER_PROPERTY_LIFECYCLES.filter(
      (lifecycle) => !(LIVE_OWNER_PROPERTY_LIFECYCLES as readonly string[]).includes(lifecycle),
    );
    expect(notLive).toEqual(['withdrawn']);
  });
});
