/**
 * @fileoverview **ΔΕΙΧΝΕΙ Η ΠΙΝΕΖΑ ΤΟΝ ΙΔΙΟ ΑΡΙΘΜΟ ΜΕ ΤΗ ΓΡΑΜΜΗ;** — ADR-332 **D26**.
 * @related components/shared/addresses/address-map-candidates
 *
 * Δύο αριθμοί ζουν σε κάθε υποψήφιο και τους μπερδεύει εύκολα κανείς:
 * **`rank`** *(ποιος είναι)* και **`position`** *(πόστος εμφανίζεται)*. Αν τους
 * μπερδέψεις, η οθόνη δεν σπάει — απλώς **τονίζει άλλη γραμμή** από αυτή που δείχνει ο
 * άνθρωπος, κι αυτό κανένα στιγμιότυπο δεν το πιάνει.
 */

import { toMapCandidates } from '../address-map-candidates';
import type { RankedCandidateLike } from '../address-map-candidates';

type Fields = RankedCandidateLike['candidate']['resolvedFields'];

function ranked(
  originalRank: number,
  overrides: {
    lat?: number;
    lng?: number;
    displayName?: string;
    fields?: Fields;
    distance?: number | null;
  } = {},
): RankedCandidateLike {
  return {
    originalRank,
    distanceFromCenterM: overrides.distance ?? null,
    candidate: {
      lat: overrides.lat ?? 37.98,
      lng: overrides.lng ?? 23.72,
      displayName: overrides.displayName ?? `Αθηνάς 5, Δήμος ${originalRank}`,
      resolvedFields: overrides.fields ?? {},
    },
  };
}

describe('toMapCandidates — ταυτότητα και σειρά είναι ΔΥΟ πράγματα', () => {
  it('η `position` βγαίνει από τη ΣΕΙΡΑ ΕΜΦΑΝΙΣΗΣ, ο `rank` από την ταυτότητα', () => {
    // Η εγγύτητα έχει ανακατατάξει: ο πάροχος τους έδωσε 0,1,2 · η οθόνη τους δείχνει 2,0,1.
    const mapped = toMapCandidates([ranked(2), ranked(0), ranked(1)]);

    expect(mapped.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(mapped.map((c) => c.rank)).toEqual([2, 0, 1]);
  });

  it('🔴 ο ίδιος κατάλογος σε ΑΛΛΗ σειρά κρατά τους ίδιους `rank` — αλλιώς σπάει ο δεσμός', () => {
    const first = toMapCandidates([ranked(0), ranked(1), ranked(2)]);
    const reordered = toMapCandidates([ranked(2), ranked(1), ranked(0)]);

    expect(new Set(first.map((c) => c.rank))).toEqual(new Set(reordered.map((c) => c.rank)));
    // ...ενώ η ΘΕΣΗ του ίδιου υποψήφιου άλλαξε — που είναι ακριβώς ο λόγος να μη δένει
    // ο δεσμός σε αυτήν.
    const positionOf = (list: typeof first, rank: number) =>
      list.find((c) => c.rank === rank)?.position;
    expect(positionOf(first, 0)).toBe(1);
    expect(positionOf(reordered, 0)).toBe(3);
  });
});

describe('toMapCandidates — η σύντομη ετικέτα', () => {
  it('προτιμά το ΣΤΕΝΟΤΕΡΟ γνωστό τοπωνύμιο (συνοικία πριν από δήμο)', () => {
    const [candidate] = toMapCandidates([
      ranked(0, { fields: { neighborhood: 'Κορυδαλλός', city: 'Αθήνα', region: 'Αττική' } }),
    ]);
    expect(candidate.label).toBe('Κορυδαλλός');
  });

  it('χωρίς συνοικία πέφτει στην πόλη, μετά στον νομό, μετά στην περιφέρεια', () => {
    expect(toMapCandidates([ranked(0, { fields: { city: 'Λάρισα', region: 'Θεσσαλία' } })])[0].label)
      .toBe('Λάρισα');
    expect(toMapCandidates([ranked(0, { fields: { county: 'Πιερίας', region: 'Μακεδονία' } })])[0].label)
      .toBe('Πιερίας');
    expect(toMapCandidates([ranked(0, { fields: { region: 'Ήπειρος' } })])[0].label)
      .toBe('Ήπειρος');
  });

  it('🔴 ΠΟΤΕ κενή ετικέτα: χωρίς κανένα τοπωνύμιο πέφτει στο πρώτο κομμάτι της γραμμής', () => {
    const [candidate] = toMapCandidates([
      ranked(0, { displayName: 'Αθηνάς, 1η Κοινότητα Περιστερίου, Δήμος Πετρούπολης', fields: {} }),
    ]);
    expect(candidate.label).toBe('Αθηνάς');
  });

  it('κενά και μόνο-κενά τοπωνύμια μετρούν ως ΑΠΟΝΤΑ, όχι ως ετικέτα', () => {
    const [candidate] = toMapCandidates([
      ranked(0, { displayName: 'Οδός Χ, κάπου', fields: { neighborhood: '   ', city: '' } }),
    ]);
    expect(candidate.label).toBe('Οδός Χ');
  });

  it('η ΠΛΗΡΗΣ γραμμή διατηρείται ακέραιη δίπλα στη σύντομη', () => {
    const full = 'Αθηνάς, Βριλήσσια, Δήμος Βριλησσίων, Περιφερειακή Ενότητα Βορείου Τομέα Αθηνών';
    const [candidate] = toMapCandidates([
      ranked(0, { displayName: full, fields: { neighborhood: 'Βριλήσσια' } }),
    ]);
    expect(candidate.label).toBe('Βριλήσσια');
    expect(candidate.fullLabel).toBe(full);
  });
});

describe('toMapCandidates — υποψήφιοι που ΔΕΝ ζωγραφίζονται', () => {
  it('🔴 μη πεπερασμένη συντεταγμένη ⇒ ΕΞΩ, ποτέ πινέζα σε απροσδιόριστο σημείο', () => {
    const mapped = toMapCandidates([
      ranked(0, { lat: NaN }),
      ranked(1, { lng: Infinity }),
      ranked(2, { lat: 40.63, lng: 22.94 }),
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].rank).toBe(2);
  });

  it('η αρίθμηση των υπολοίπων ΔΕΝ αφήνει κενό εκεί που έπεσε ο απορριφθείς', () => {
    const mapped = toMapCandidates([ranked(0, { lat: NaN }), ranked(1), ranked(2)]);
    expect(mapped.map((c) => c.position)).toEqual([1, 2]);
  });

  it('κενός κατάλογος ⇒ κενός κατάλογος', () => {
    expect(toMapCandidates([])).toEqual([]);
  });
});

describe('toMapCandidates — η απόσταση περνά ΑΝΕΠΑΦΗ', () => {
  it('τα μέτρα φτάνουν όπως δόθηκαν — η μορφοποίηση είναι αλλουνού δουλειά (Intl)', () => {
    const [candidate] = toMapCandidates([ranked(0, { distance: 296_412 })]);
    expect(candidate.distanceM).toBe(296_412);
  });

  it('χωρίς αφετηρία εγγύτητας η απόσταση μένει `null`, όχι μηδέν', () => {
    // Το μηδέν θα σήμαινε «ακριβώς εδώ» — ψέμα. Το `null` σημαίνει «δεν ξέρω».
    const [candidate] = toMapCandidates([ranked(0, { distance: null })]);
    expect(candidate.distanceM).toBeNull();
  });
});
