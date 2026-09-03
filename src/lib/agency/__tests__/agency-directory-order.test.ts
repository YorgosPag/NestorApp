/**
 * @fileoverview Άγκυρες της **ουδέτερης σειράς** του καταλόγου (ADR-843 ΠΕ7 · ADR-827 §9.9 α).
 * @related lib/agency/agency-directory-order.ts
 *
 * 🔴 **Τι φυλάει η ομάδα Ε (εγγύτητα)**: ότι ο πιο κοντινός είναι πρώτος, **και** ότι
 * η ζώνη ισοπαλίας **υπάρχει**. Οι δύο άγκυρες Ε3/Ε4 είναι **ζεύγος**, και μόνο μαζί
 * καρφώνουν τη ζώνη: η μία απαιτεί ότι μέσα στη ζώνη η σειρά **μπορεί** να γυρίσει, η
 * άλλη ότι **έξω** από αυτήν **ποτέ** δεν γυρίζει. Μία μόνη τους περνά και από
 * υλοποίηση που ταξινομεί σκέτα κατά απόσταση *(η Ε4)* και από υλοποίηση που τα κάνει
 * **όλα** ισότιμα *(η Ε3)*.
 *
 * 🔴 **Τι φυλάει η ομάδα Κ**: ότι η σειρά είναι **ΟΛΙΚΗ**. Ένας συγκριτής χωρίς
 * tie-break περνά **κάθε** δοκιμή που τον καλεί μέσω `Array#sort`, επειδή η `sort` είναι
 * σταθερή από την ES2019 — δηλαδή η απουσία του τερματισμού θα ήταν **αόρατη** και θα
 * φαινόταν μόνο στην παραγωγή. Γι' αυτό η Κ2 καλεί τον **συγκριτή απευθείας**.
 *
 * 🔴 **Τι φυλάει η ομάδα Α**: ότι κανένα **εμπορικό** κριτήριο δεν μπήκε ποτέ — και
 * πλέον ούτε η **επωνυμία**: μετά το ΠΕ7 το όνομα **δεν αποφασίζει τίποτα**, και η
 * παγίδα το φυλάει.
 */

import { orderAgencies, compareWithinBand } from '../agency-directory-order';
import { PROXIMITY_TIE_MARGIN } from '@/lib/contact/first-contact-limits';
import type { PublicShowcase } from '@/types/agency-profile';
import type { GeoPoint } from '@/types/geo/coordinates';
// 🔑 N.18 — ΕΝΑ δείγμα, πολλές σουίτες.
import { showcaseFixture as profile } from '../__fixtures__/showcase-fixture';

const ORIGIN: GeoPoint = { lat: 0, lng: 0 };

/** Μοίρες γεωγραφικού πλάτους ανά μέτρο — αρκετά ακριβές για άγκυρα διάταξης. */
const METRES_PER_DEGREE = 111_320;

/** Μια βιτρίνα σε δεδομένη **απόσταση** από την αφετηρία. */
function at(metres: number, companyId: string, displayName = 'Ίδιο'): PublicShowcase {
  return profile({
    companyId,
    displayName,
    position: { lat: metres / METRES_PER_DEGREE, lng: 0 },
  });
}

/**
 * ⚠️ **Σταθερή λίστα σπόρων, ΠΟΤΕ τυχαία** — μια άγκυρα που παράγει δικό της τυχαίο
 * είναι άγκυρα που μπορεί να κοκκινίσει **χωρίς αλλαγή κώδικα**.
 */
const SEEDS = Array.from({ length: 24 }, (_, index) => `seed-${index}`);

const idsOf = (profiles: readonly PublicShowcase[]): string[] =>
  profiles.map((p) => p.companyId);

describe('Ε. ΕΓΓΥΤΗΤΑ — ο πιο κοντινός πρώτος (ADR-843 ΠΕ7)', () => {
  it('Ε1 — ο πιο κοντινός πρώτος, όταν οι αποστάσεις είναι σαφώς διαφορετικές', () => {
    const ordered = orderAgencies(
      [at(50_000, 'comp_far'), at(1_000, 'comp_near'), at(10_000, 'comp_mid')],
      { from: ORIGIN, seed: 'any' },
    );

    expect(idsOf(ordered)).toEqual(['comp_near', 'comp_mid', 'comp_far']);
  });

  it('Ε2 — όποιος ΔΕΝ δήλωσε τόπο πηγαίνει τελευταίος (δεν ανταμείβεται η σιωπή)', () => {
    const ordered = orderAgencies(
      [profile({ companyId: 'comp_silent', position: null }), at(90_000, 'comp_far')],
      { from: ORIGIN, seed: 'any' },
    );

    expect(idsOf(ordered)).toEqual(['comp_far', 'comp_silent']);
  });

  it('Ε3 🔑 — ΜΕΣΑ στη ζώνη η σειρά ΓΥΡΙΖΕΙ ανά άνθρωπο (η ζώνη υπάρχει)', () => {
    // 2.000 μ. ⇒ οροφή 2.500 μ. Ο δεύτερος στα 2.400 είναι **ισότιμος**.
    const inBand = 2_000 * (1 + PROXIMITY_TIE_MARGIN) - 100;
    const flipped = SEEDS.some((seed) => {
      const ordered = orderAgencies(
        [at(2_000, 'comp_closer'), at(inBand, 'comp_tied')],
        { from: ORIGIN, seed },
      );
      return ordered[0].companyId === 'comp_tied';
    });

    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΙΑΝΕΙ ΤΗΝ ΑΦΑΙΡΕΣΗ ΤΗΣ ΖΩΝΗΣ. Με σκέτη ταξινόμηση κατά
    //    απόσταση, ο `comp_tied` **δεν βγαίνει ποτέ πρώτος** — για κανέναν σπόρο.
    expect(flipped).toBe(true);
  });

  it('Ε4 🔑 — ΕΞΩ από τη ζώνη η σειρά ΔΕΝ γυρίζει ΠΟΤΕ (η ζώνη δεν είναι «όλοι»)', () => {
    // 2.000 μ. ⇒ οροφή 2.500 μ. Ο δεύτερος στα 2.600 είναι **έξω**.
    const outOfBand = 2_000 * (1 + PROXIMITY_TIE_MARGIN) + 100;
    const everFlipped = SEEDS.some((seed) => {
      const ordered = orderAgencies(
        [at(2_000, 'comp_closer'), at(outOfBand, 'comp_farther')],
        { from: ORIGIN, seed },
      );
      return ordered[0].companyId === 'comp_farther';
    });

    // 🔴 Η ΣΥΜΠΛΗΡΩΜΑΤΙΚΗ ΤΗΣ Ε3. Μια υλοποίηση που κάνει **τα πάντα** ισότιμα
    //    περνά την Ε3 και **κοκκινίζει εδώ** — δηλαδή το ζεύγος καρφώνει το κατώφλι.
    expect(everFlipped).toBe(false);
  });

  it('Ε5 🔑 — η ζώνη είναι ΣΧΕΤΙΚΗ: 20/24 χλμ. ισοπαλία, 2/2,6 χλμ. όχι', () => {
    // 🔴 ΤΟ ΘΕΜΑ ΤΟΥ Θ-6: ένα **απόλυτο** κατώφλι (π.χ. 500 μ.) θα έκανε τα 20/24 χλμ.
    //    **μη** ισόπαλα, ενώ το σχετικό τα κάνει ισόπαλα — και ταυτόχρονα κρατά τα
    //    2/2,6 χλμ. **χωριστά**. Οι δύο απαντήσεις μαζί υπάρχουν **μόνο** στο σχετικό.
    const farPairFlips = SEEDS.some((seed) => {
      const ordered = orderAgencies(
        [at(20_000, 'comp_a'), at(24_000, 'comp_b')],
        { from: ORIGIN, seed },
      );
      return ordered[0].companyId === 'comp_b';
    });

    expect(farPairFlips).toBe(true);
  });

  it('Ε6 — χωρίς αφετηρία, ΟΛΟΙ ισότιμοι — και ΟΧΙ αλφαβητικά', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΙΑΝΕΙ ΤΗΝ ΕΠΙΣΤΡΟΦΗ ΣΤΟ ΑΛΦΑΒΗΤΙΚΑ «ΩΣ ΑΣΦΑΛΗ ΠΡΟΕΠΙΛΟΓΗ».
    //    Θα ξαναγεννούσε τη μεροληψία «ΑΑΑ…» ακριβώς για τους επισκέπτες που δεν μας
    //    είπαν πού είναι — δηλαδή για τους περισσότερους.
    const alphabetical = ['comp_1', 'comp_2', 'comp_3', 'comp_4', 'comp_5'];
    const population = alphabetical.map((id, index) =>
      profile({ companyId: id, displayName: `Γραφείο ${index + 1}` }),
    );

    const everDiffers = SEEDS.some(
      (seed) => idsOf(orderAgencies(population, { from: null, seed })).join() !== alphabetical.join(),
    );

    expect(everDiffers).toBe(true);
  });
});

describe('Κ. Η σειρά είναι ΟΛΙΚΗ και ΣΤΑΘΕΡΗ ανά άνθρωπο', () => {
  it('Κ1 — ίδια έξοδος για ΚΑΘΕ σειρά εισόδου, με τον ίδιο σπόρο', () => {
    const a = at(2_000, 'comp_111');
    const b = at(2_100, 'comp_222');
    const c = at(2_200, 'comp_333');

    const expected = idsOf(orderAgencies([a, b, c], { from: ORIGIN, seed: 'γιώργος' }));
    for (const input of [[c, b, a], [b, c, a], [c, a, b], [a, c, b]]) {
      expect(idsOf(orderAgencies(input, { from: ORIGIN, seed: 'γιώργος' }))).toEqual(expected);
    }
  });

  it('Κ2 🔑 — ΙΔΙΟΣ κλήρος: ο ΣΥΓΚΡΙΤΗΣ (όχι η sort) δίνει σταθερή σειρά', () => {
    const first = profile({ companyId: 'comp_aaa', displayName: 'Ίδιο' });
    const second = profile({ companyId: 'comp_bbb', displayName: 'Ίδιο' });

    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΙΑΝΕΙ ΤΗΝ ΑΦΑΙΡΕΣΗ ΤΟΥ ΤΕΡΜΑΤΙΣΜΟΥ. Μέσω `sort` δύο ίσα
    //    στοιχεία θα κρατούσαν τη σειρά εισόδου — πράσινο σε συγκριτή που ΔΕΝ
    //    αποφασίζει τίποτα.
    expect(compareWithinBand('s', first, second)).not.toBe(0);
    expect(Math.sign(compareWithinBand('s', first, second)))
      .toBe(-Math.sign(compareWithinBand('s', second, first)));
    expect(compareWithinBand('s', first, first)).toBe(0);
  });

  it('Κ3 — ο ΙΔΙΟΣ άνθρωπος βλέπει ΠΑΝΤΑ την ίδια σειρά', () => {
    const population = ['comp_a', 'comp_b', 'comp_c', 'comp_d'].map((id) => at(2_000, id));
    const once = idsOf(orderAgencies(population, { from: ORIGIN, seed: 'ίδιος' }));
    const again = idsOf(orderAgencies(population, { from: ORIGIN, seed: 'ίδιος' }));

    expect(again).toEqual(once);
  });

  it('Κ5 🔑 — ΔΥΟ άνθρωποι βλέπουν ΔΙΑΦΟΡΕΤΙΚΗ σειρά (ο σπόρος ΜΕΤΡΑΕΙ)', () => {
    // 🔴 ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ (2026-09-03). Αφαιρώντας τον σπόρο
    //    από τον κλήρο (`material = companyId`), **και οι δώδεκα** άγκυρες έμεναν
    //    πράσινες — ενώ η συμπεριφορά ήταν **ακριβώς η μεροληψία που το ΠΕ7 έδιωξε**:
    //    μια **σταθερή** σειρά ισοπαλίας που ευνοεί **συστηματικά** τα ίδια γραφεία,
    //    απλώς με κριτήριο τον κατακερματισμό αντί για το αλφάβητο. Αόρατη, και
    //    χειρότερη — γιατί κανείς δεν θα την υποψιαζόταν.
    const population = ['comp_a', 'comp_b', 'comp_c', 'comp_d'].map((id) => at(2_000, id));
    const distinct = new Set(
      SEEDS.map((seed) => idsOf(orderAgencies(population, { from: ORIGIN, seed })).join()),
    );

    expect(distinct.size).toBeGreaterThan(1);
  });

  it('Κ4 — ΔΕΝ μεταβάλλει την είσοδο (ανήκει στη συνδρομή)', () => {
    const input = [at(9_000, 'comp_z'), at(1_000, 'comp_a')];
    const snapshot = idsOf(input);

    orderAgencies(input, { from: ORIGIN, seed: 's' });

    expect(idsOf(input)).toEqual(snapshot);
  });
});

describe('Α. Antitrust — καμία εμπορική είσοδος (ADR-827 §9.9 α, NAR $418M)', () => {
  it('Α1 🔑 — ο συγκριτής της ισοπαλίας διαβάζει ΜΟΝΟ `companyId`', () => {
    // 🔴 Η ΔΟΜΙΚΗ ΑΠΟΔΕΙΞΗ: κάθε ΑΛΛΟ πεδίο γίνεται παγίδα. Αν κάποιος προσθέσει
    //    ποτέ κριτήριο («πρώτα τα πρόσφατα», «πρώτα οι επαληθευμένοι»), η ανάγνωση
    //    πυροδοτεί ΕΔΩ — πριν φτάσει σε κατάταξη επί πληρωμή.
    //
    // ⚠️ ΤΟ `displayName` ΜΠΗΚΕ ΣΤΗ ΛΙΣΤΑ ΜΕ ΤΟ ΠΕ7. Πριν ήταν το **κριτήριο**·
    //    τώρα δεν αποφασίζει τίποτα, και η μεροληψία «ΑΑΑ…» δεν μπορεί να επιστρέψει
    //    κρυφά μέσα από την ισοπαλία.
    const forbidden: (keyof PublicShowcase)[] = [
      'alias',
      'credentials',
      'displayName',
      'place',
      'position',
      'publishedAt',
    ];
    const touched: string[] = [];

    const trap = (companyId: string): PublicShowcase => {
      const base = profile({ companyId });
      const guarded = { ...base };
      for (const field of forbidden) {
        Object.defineProperty(guarded, field, {
          get() {
            touched.push(field);
            return base[field];
          },
        });
      }
      return guarded;
    };

    compareWithinBand('s', trap('comp_a'), trap('comp_b'));
    compareWithinBand('s', trap('comp_a'), trap('comp_a'));

    expect(touched).toEqual([]);
  });

  it('Α2 — το σχήμα ΔΕΝ φέρει πεδίο που να μπορεί να κατατάξει εμπορικά', () => {
    // Ο ΠΡΩΤΟΣ φρουρός είναι δομικός: πεδίο που δεν υπάρχει δεν ταξινομείται.
    const keys = Object.keys(profile({}));
    for (const commercial of ['fee', 'commission', 'rating', 'score', 'rank', 'promoted', 'featured', 'sponsored']) {
      expect(keys).not.toContain(commercial);
    }
  });
});
