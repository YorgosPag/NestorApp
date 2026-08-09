/**
 * Unit tests — οι ΕΤΙΚΕΤΕΣ των τιμών στην κάρτα ακινήτου (ADR-777 §8.2 #3).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο φάκελος `src/domain/cards/property/` δεν είχε **κανένα**
 * test (ADR-777, ανοιχτό #6): ο resolver ήταν αποδεδειγμένος, αλλά **τίποτα
 * δεν κλείδωνε τι ΛΕΞΗ γράφεται δίπλα σε κάθε αριθμό**. Η κάρτα έγραφε τη
 * δεύτερη γραμμή σκληρά ως «Ενοίκιο», κάτι που ήταν αληθές μόνο όσο η δεύτερη
 * γραμμή μπορούσε να είναι μόνο ενοίκιο. Από τη στιγμή που ένα πωλημένο
 * ακίνητο άρχισε να κουβαλά εκεί τη ζητούμενη τιμή του, η ίδια γραμμή θα
 * βάφτιζε **200.000 € ως «Ενοίκιο»** — και καμία πύλη δεν θα το έβλεπε, γιατί
 * ο μεταγλωττιστής δεν έχει γνώμη για μια συμβολοσειρά κλειδιού.
 *
 * ⚠️ Ο έλεγχος γίνεται στις **ετικέτες**, όχι στα ποσά: τα ποσά τα αποδεικνύει
 * ήδη το `price-resolver.test.ts`. Εδώ κρίνεται μόνο το ερώτημα που κανείς δεν
 * ρωτούσε: *«λέει η κάρτα την αλήθεια για το τι είναι ο κάθε αριθμός;»*
 */
import {
  buildPropertyPriceStats,
  buildPropertyPricePerSqmStats,
} from '@/domain/cards/property/property-card-shared';
import type { Property } from '@/types/property-viewer';

/** Το `t` επιστρέφει το ίδιο το κλειδί — κρίνουμε ΠΟΙΟ κλειδί ζητήθηκε. */
const t = (key: string, opts?: Record<string, unknown>): string =>
  opts && 'amount' in opts ? `${key}:${String(opts.amount)}` : key;

/** Δομικό ελάχιστο — μόνο ό,τι διαβάζει ο resolver. */
function unit(commercialStatus: string, commercial: Record<string, number>): Property {
  return { commercialStatus, commercial } as unknown as Property;
}

const labelsOf = (p: Property): string[] =>
  buildPropertyPriceStats(p, t).map((s) => s.label);

// =============================================================================
// Κ1 — ΤΟ ΠΩΛΗΜΕΝΟ: «Τιμή πώλησης» + «Ζητούσε», ΠΟΤΕ «Ενοίκιο»
// =============================================================================

describe('Κ1 — sold: η δεύτερη γραμμή είναι η ζητούμενη, όχι ενοίκιο', () => {
  const sold = unit('sold', { askingPrice: 200_000, finalPrice: 185_000 });

  it('γράφει «τιμή πώλησης» και «ζητούσε»', () => {
    expect(labelsOf(sold)).toEqual(['card.stats.soldFor', 'card.stats.askedFor']);
  });

  it('🔴 ΔΕΝ γράφει ΠΟΥΘΕΝΑ «ενοίκιο» σε πωλημένο ακίνητο', () => {
    // Η άγκυρα του πραγματικού κινδύνου: η παλιά γραμμή ήταν σκληρά 'rent'.
    expect(labelsOf(sold)).not.toContain('card.stats.rent');
  });

  it('τα ποσά μένουν σκέτοι αριθμοί — καμία περίοδος «/μήνα»', () => {
    const values = buildPropertyPriceStats(sold, t).map((s) => s.value);
    expect(values.every((v) => !String(v).includes('rentValue'))).toBe(true);
  });
});

// =============================================================================
// Κ2 — ΟΙ ΥΠΟΛΟΙΠΕΣ ΠΕΡΙΠΤΩΣΕΙΣ ΔΕΝ ΑΛΛΑΞΑΝ
// =============================================================================

describe('Κ2 — οι προϋπάρχουσες περιπτώσεις μένουν ακριβώς ίδιες', () => {
  it('σκέτη πώληση → μία γραμμή «Τιμή»', () => {
    expect(labelsOf(unit('for-sale', { askingPrice: 200_000 }))).toEqual([
      'card.stats.price',
    ]);
  });

  it('σκέτη ενοικίαση → μία γραμμή «Ενοίκιο»', () => {
    expect(labelsOf(unit('for-rent', { rentPrice: 500 }))).toEqual(['card.stats.rent']);
  });

  it('διπλό listing → «Πώληση» + «Ενοίκιο», με αυτή τη σειρά', () => {
    expect(
      labelsOf(unit('for-sale-and-rent', { askingPrice: 200_000, rentPrice: 500 })),
    ).toEqual(['card.stats.sale', 'card.stats.rent']);
  });

  it('χωρίς τιμή → καμία γραμμή τιμής (η απουσία λέγεται αλλού)', () => {
    expect(buildPropertyPriceStats(unit('for-sale', {}), t)).toEqual([]);
  });
});

// =============================================================================
// Κ3 — €/τ.μ.: δύο γραμμές μόνο όταν είναι ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ ΠΛΕΥΡΕΣ
// =============================================================================

describe('Κ3 — €/τ.μ. δεν τυπώνεται δύο φορές κάτω από την ίδια ετικέτα', () => {
  it('πωλημένο → ΜΙΑ γραμμή (και οι δύο αριθμοί είναι πώληση)', () => {
    const rows = buildPropertyPricePerSqmStats(
      unit('sold', { askingPrice: 200_000, finalPrice: 185_000 }),
      100,
      t,
    );
    // Δύο γραμμές «Πώληση/τ.μ.» με διαφορετικό νούμερο είναι γραμμή που ο
    // αναγνώστης δεν μπορεί να ερμηνεύσει.
    expect(rows.map((r) => r.label)).toEqual(['card.stats.salePricePerSqm']);
    // 185.000/100 = 1.850 — ΤΟΥ ΣΥΜΒΟΛΑΙΟΥ. Η ζητούμενη θα έδινε 2.000.
    // (Ο διαχωριστής χιλιάδων εξαρτάται από τη locale του περιβάλλοντος, γι'
    //  αυτό συγκρίνονται τα ψηφία, όχι η μορφοποίηση.)
    const digits = String(rows[0]?.value).replace(/\D/g, '');
    expect(digits).toBe('1850');
    expect(digits).not.toBe('2000');
  });

  it('διπλό listing → ΔΥΟ γραμμές (πώληση και ενοίκιο είναι άλλη πλευρά)', () => {
    const rows = buildPropertyPricePerSqmStats(
      unit('for-sale-and-rent', { askingPrice: 200_000, rentPrice: 500 }),
      100,
      t,
    );
    expect(rows.map((r) => r.label)).toEqual([
      'card.stats.salePricePerSqm',
      'card.stats.rentPricePerSqm',
    ]);
  });

  it('χωρίς εμβαδόν → καμία γραμμή', () => {
    expect(
      buildPropertyPricePerSqmStats(unit('sold', { finalPrice: 185_000 }), 0, t),
    ).toEqual([]);
  });
});
