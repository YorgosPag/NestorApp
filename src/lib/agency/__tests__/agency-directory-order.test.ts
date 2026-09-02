/**
 * @fileoverview Άγκυρες της **ουδέτερης σειράς** του καταλόγου (ADR-827 §9.9 α).
 * @related lib/agency/agency-directory-order.ts
 *
 * 🔴 **Τι φυλάει η ομάδα Κ**: ότι η σειρά είναι **ΟΛΙΚΗ**. Ένας συγκριτής χωρίς
 * tie-break περνά **κάθε** δοκιμή που τον καλεί μέσω `Array#sort`, επειδή η `sort`
 * είναι σταθερή από την ES2019 — δηλαδή η απουσία του τερματισμού θα ήταν
 * **αόρατη** και θα φαινόταν μόνο στην παραγωγή, ως σειρά που αλλάζει ανάμεσα σε
 * δύο φορτώσεις. Γι' αυτό η Κ3 καλεί τον **συγκριτή απευθείας**.
 *
 * 🔴 **Τι φυλάει η ομάδα Α**: ότι κανένα **εμπορικό** κριτήριο δεν μπήκε ποτέ.
 */

import { orderAgencies, compareAgencies } from '../agency-directory-order';
import type { PublicShowcase } from '@/types/agency-profile';
// 🔑 N.18 — ΕΝΑ δείγμα, τρεις σουίτες. Ήταν τρία αντίγραφα και έσπασαν όλα μαζί
//    όταν το `gemiNumber` γενικεύτηκε σε `credentials[]` (ADR-841 Φ6-Β).
import { showcaseFixture as profile } from '../__fixtures__/showcase-fixture';

describe('Κ. Η σειρά είναι ΟΛΙΚΗ, όχι απλώς αλφαβητική', () => {
  it('Κ1 — ταξινομεί κατά επωνυμία με ελληνικό collation', () => {
    const ordered = orderAgencies([
      profile({ displayName: 'Ζωγράφου Ακίνητα', companyId: 'comp_c' }),
      profile({ displayName: 'Αλεξίου Μεσιτικό', companyId: 'comp_a' }),
      profile({ displayName: 'Μαυρίδης Real Estate', companyId: 'comp_b' }),
    ]);

    // ⚠️ Ζ ΠΡΙΝ Μ — ελληνικό αλφάβητο, όχι λατινικό. Η πρώτη γραφή αυτής της
    //    άγκυρας περίμενε λατινική σειρά και ΚΟΚΚΙΝΙΣΕ: ο collator είχε δίκιο.
    expect(ordered.map((p) => p.displayName)).toEqual([
      'Αλεξίου Μεσιτικό',
      'Ζωγράφου Ακίνητα',
      'Μαυρίδης Real Estate',
    ]);
  });

  it('Κ2 🔑 — τόνος και κεφαλαία ΔΕΝ αποφασίζουν: αποφασίζει ο τερματισμός', () => {
    // 🔴 Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΗΤΑΝ ΣΧΟΛΙΟ ΠΟΥ ΕΜΟΙΑΖΕ ΜΕ ΕΛΕΓΧΟ.
    //    Σύγκρινε «ΆΛΦΑ» με «ΒΗΤΑ» — αλλά το `Α` προηγείται του `Β` σε ΚΑΘΕ
    //    ευαισθησία, άρα η μετάλλαξη `base → variant` έβγαινε **ΠΡΑΣΙΝΗ**
    //    (μετρημένο). Ο τόνος κρίνει ΜΟΝΟ όταν η ΒΑΣΗ των γραμμάτων ταυτίζεται.
    //
    // Εδώ οι επωνυμίες διαφέρουν **μόνο** σε τόνο/πεζά-κεφαλαία ⇒ με
    // `sensitivity: 'base'` η σύγκριση ονόματος είναι **0** και αποφασίζει το
    // `companyId`. Τα `companyId` επιλέγονται ώστε οι δύο ερμηνείες να δίνουν
    // **αντίθετο** πρόσημο.
    const accented = profile({ displayName: 'Άλφα', companyId: 'comp_aaa' });
    const plain = profile({ displayName: 'Αλφα', companyId: 'comp_zzz' });
    // base → 0 στο όνομα → aaa πριν zzz → αρνητικό.  variant → +1. 
    expect(compareAgencies(accented, plain)).toBeLessThan(0);

    const upper = profile({ displayName: 'ΒΑΣΗΣ', companyId: 'comp_zzz' });
    const mixed = profile({ displayName: 'Βάσης', companyId: 'comp_aaa' });
    // base → 0 στο όνομα → aaa πριν zzz → θετικό.  variant → −1.
    expect(compareAgencies(upper, mixed)).toBeGreaterThan(0);
  });

  it('Κ3 🔑 — ΙΔΙΑ επωνυμία: ο ΣΥΓΚΡΙΤΗΣ (όχι η sort) δίνει σταθερή σειρά', () => {
    const first = profile({ displayName: 'Ακίνητα Α.Ε.', companyId: 'comp_aaa' });
    const second = profile({ displayName: 'Ακίνητα Α.Ε.', companyId: 'comp_bbb' });

    // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΙΑΝΕΙ ΤΗΝ ΑΦΑΙΡΕΣΗ ΤΟΥ TIE-BREAK. Μέσω `sort` και τα δύο
    //    θα ήταν `0` και η σταθερή `sort` θα κρατούσε τη σειρά εισόδου — πράσινο
    //    σε συγκριτή που ΔΕΝ αποφασίζει τίποτα.
    expect(compareAgencies(first, second)).toBeLessThan(0);
    expect(compareAgencies(second, first)).toBeGreaterThan(0);
    expect(compareAgencies(first, first)).toBe(0);
  });

  it('Κ4 — ίδια έξοδος για ΚΑΘΕ σειρά εισόδου (ολική σχέση)', () => {
    const a = profile({ displayName: 'Ίδιο Όνομα', companyId: 'comp_111' });
    const b = profile({ displayName: 'Ίδιο Όνομα', companyId: 'comp_222' });
    const c = profile({ displayName: 'Ίδιο Όνομα', companyId: 'comp_333' });

    const expected = ['comp_111', 'comp_222', 'comp_333'];
    for (const input of [
      [a, b, c],
      [c, b, a],
      [b, c, a],
      [c, a, b],
    ]) {
      expect(orderAgencies(input).map((p) => p.companyId)).toEqual(expected);
    }
  });

  it('Κ5 — «Γραφείο 2» πριν από «Γραφείο 10» (numeric collation)', () => {
    const ordered = orderAgencies([
      profile({ displayName: 'Γραφείο 10', companyId: 'comp_b' }),
      profile({ displayName: 'Γραφείο 2', companyId: 'comp_a' }),
    ]);

    expect(ordered.map((p) => p.displayName)).toEqual(['Γραφείο 2', 'Γραφείο 10']);
  });

  it('Κ6 — ΔΕΝ μεταβάλλει την είσοδο (ανήκει στη συνδρομή)', () => {
    const input = [
      profile({ displayName: 'Ωμέγα', companyId: 'comp_z' }),
      profile({ displayName: 'Άλφα', companyId: 'comp_a' }),
    ];
    const snapshot = input.map((p) => p.companyId);

    orderAgencies(input);

    expect(input.map((p) => p.companyId)).toEqual(snapshot);
  });
});

describe('Α. Antitrust — καμία εμπορική είσοδος (ADR-827 §9.9 α, NAR $418M)', () => {
  it('Α1 🔑 — ο συγκριτής διαβάζει ΜΟΝΟ `displayName` και `companyId`', () => {
    // 🔴 Η ΔΟΜΙΚΗ ΑΠΟΔΕΙΞΗ: κάθε ΑΛΛΟ πεδίο γίνεται παγίδα. Αν κάποιος προσθέσει
    //    ποτέ κριτήριο («πρώτα τα πρόσφατα», «πρώτα όσα έχουν τόπο»), η ανάγνωση
    //    πυροδοτεί ΕΔΩ — πριν φτάσει σε κατάταξη επί πληρωμή.
    const forbidden: (keyof PublicShowcase)[] = [
      'alias',
      // 🔴 Φ6-Β: ΝΕΑ ΠΑΓΙΔΑ. Το `credentials` κουβαλά πλέον την ΕΙΔΙΚΟΤΗΤΑ και την
      //    ΑΠΟΔΕΙΞΗ — δηλαδή ό,τι θα ήθελε κανείς για «πρώτα οι επαληθευμένοι».
      //    Αν ο συγκριτής το αγγίξει ποτέ, πυροδοτεί ΕΔΩ.
      'credentials',
      'place',
      'position',
      'publishedAt',
    ];
    const touched: string[] = [];

    const trap = (companyId: string, displayName: string): PublicShowcase => {
      const base = profile({ companyId, displayName });
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

    compareAgencies(trap('comp_a', 'Άλφα'), trap('comp_b', 'Βήτα'));
    compareAgencies(trap('comp_a', 'Ίδιο'), trap('comp_b', 'Ίδιο'));

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
