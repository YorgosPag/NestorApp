/**
 * ⚠️ **ΟΡΓΑΝΟ ΜΕΤΡΗΣΗΣ — ΔΕΝ ΕΙΝΑΙ ΠΥΛΗ.** ADR-777 §8.52 βήμα 1.
 *
 * Το `UNCERTAIN_BLOCKERS` γράφει **κατά λέξη**: *«ΜΗΝ μεταφέρεις εδώ τα υπόλοιπα
 * `*-unknown` χωρίς μέτρηση»*. Αυτό το αρχείο **κάνει τη μέτρηση**, με τον **ΕΝΑΝ**
 * αναγνώστη (`readNumericAnswer`), πάνω σε **αντίγραφο του πραγματικού** `public_listings`
 * της 2026-09-05 — ώστε ο αριθμός να μην είναι εικασία.
 *
 * 🔴 **ΔΙΑΒΑΣΕ ΤΟ ΠΟΡΙΣΜΑ ΠΡΙΝ ΤΟΝ ΑΡΙΘΜΟ**: το σώμα είναι **8 χειροποίητα δοκίμια**
 * (`ΔΟΚΙΜΗ Α…Δ`, `TEST-2`), όχι αγορά. Ό,τι μετρηθεί εδώ ως **συχνότητα** είναι μέτρηση
 * του τι πληκτρολόγησε κάποιος όταν έφτιαχνε δοκίμια — **όχι** του κόσμου. Γι' αυτό οι
 * ισχυρισμοί αυτού του αρχείου είναι **υπάρξεως**, ποτέ **αναλογίας**.
 */

import { readNumericAnswer } from '@/lib/criteria/listing-criterion-reading';
import type { RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import type { PublicListing } from '@/types/public-listing';
import { LISTING_CORPUS_2026_09_05 } from './__fixtures__/public-listings-corpus';

const AXES: readonly RangeCriterionKey[] = ['price', 'areaSqm', 'bedrooms', 'floor'];

type Tally = { declared: number; neverAsked: number; declaredNone: number; notApplicable: number };

function tally(listings: readonly PublicListing[], key: RangeCriterionKey): Tally {
  const out: Tally = { declared: 0, neverAsked: 0, declaredNone: 0, notApplicable: 0 };
  for (const listing of listings) {
    const answer = readNumericAnswer(listing, key);
    if (answer.state === 'declared') out.declared += 1;
    else if (answer.state === 'never-asked') out.neverAsked += 1;
    else if (answer.state === 'declared-none') out.declaredNone += 1;
    else out.notApplicable += 1;
  }
  return out;
}

describe('ADR-777 §8.52 — η μέτρηση της σιωπής, με τον ΕΝΑΝ αναγνώστη', () => {
  const corpus = LISTING_CORPUS_2026_09_05;

  it('τυπώνει τον πίνακα που πάει στο ADR — και ΠΟΤΕ δεν κρίνει', () => {
    const rows = AXES.map((key) => ({ key, ...tally(corpus, key) }));
    // eslint-disable-next-line no-console -- όργανο μέτρησης, όχι κώδικας παραγωγής
    console.log('\nADR-777 §8.52 · σώμα ' + corpus.length + ' αγγελιών (2026-09-05)\n' +
      rows.map((r) => `  ${r.key.padEnd(9)} δηλωμένο ${r.declared} · σιωπή ${r.neverAsked} · δεν σηκώνει την ερώτηση ${r.notApplicable}`).join('\n'));
    expect(rows).toHaveLength(4);
  });

  // ─── ΙΣΧΥΡΙΣΜΟΙ ΥΠΑΡΞΕΩΣ — αυτό ΜΠΟΡΕΙ να αποδείξει ένα σώμα 8 δοκιμίων ────────

  it('Υ1 — υπάρχει αγγελία ΧΩΡΙΣ δηλωμένη τιμή ⇒ το `price-above` ΕΙΝΑΙ προσβάσιμο ψέμα', () => {
    expect(tally(corpus, 'price').neverAsked).toBeGreaterThan(0);
  });

  it('Υ2 — υπάρχει γη που ΔΕΝ ΣΗΚΩΝΕΙ τις ερωτήσεις ορόφου/υπνοδωματίων', () => {
    // 🔴 Αυτό είναι το ΕΥΡΗΜΑ 4: η αναζήτηση το ξέρει (§8.50, `LAND_CANNOT_ANSWER`),
    // η ζήτηση **όχι** — και κρίνει οικόπεδο σε υπνοδωμάτια. Η ίδια αγγελία, δύο
    // απαντήσεις, στην ίδια εφαρμογή.
    expect(tally(corpus, 'bedrooms').notApplicable).toBeGreaterThan(0);
    expect(tally(corpus, 'floor').notApplicable).toBeGreaterThan(0);
  });

  it('Υ3 — η γη ΑΠΑΝΤΑ κανονικά σε εμβαδόν: η εξαίρεση είναι ανά ΑΞΟΝΑ, όχι ανά αγγελία', () => {
    expect(tally(corpus, 'areaSqm').notApplicable).toBe(0);
  });
});
