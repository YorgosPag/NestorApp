/**
 * Άγκυρες — ADR-777 §8.60.14.13 (Φάση 3): **τα αθροίσματα τιμής ζουν ΑΝΑ ΡΟΛΟ.**
 *
 * Το περιστατικό: επτά εσωτερικές οθόνες έγραφαν «Συνολική Αξία: Χ €» προσθέτοντας τιμές
 * πώλησης, μηνιαία ενοίκια και τιμές ανά νύχτα. Κάθε άγκυρα εδώ πρέπει να ΚΟΚΚΙΝΙΖΕΙ αν
 * η μηχανή ξαναρχίσει να προσθέτει ανόμοιες μονάδες — μια άγκυρα που δεν κοκκινίζει δεν
 * είναι άγκυρα.
 */
// Η πραγματική υλοποίηση, τυλιγμένη ώστε να μετριούνται οι κλήσεις (Α5) — συμπεριφορά ίδια.
jest.mock('@/lib/properties/price-resolver', () => {
  const actual = jest.requireActual<typeof import('@/lib/properties/price-resolver')>(
    '@/lib/properties/price-resolver',
  );
  return { ...actual, resolveDisplayPrice: jest.fn(actual.resolveDisplayPrice) };
});

import {
  resolveDisplayPrice,
  PRICE_ROLE_ORDER,
  PRICE_ROLES,
  type PriceRole,
  type PricedPropertyLike,
} from '@/lib/properties/price-resolver';
import {
  EMPTY_PRICE_TOTALS,
  pricedRolesOf,
  totalPriceByRole,
  type PriceTotalsByRole,
} from '@/lib/properties/price-totals';

interface Unit extends PricedPropertyLike {
  readonly area?: number | null;
}

const sale = (askingPrice: number, area?: number): Unit =>
  ({ commercialStatus: 'for-sale', commercial: { askingPrice }, area });
const rent = (rentPrice: number, area?: number): Unit =>
  ({ commercialStatus: 'for-rent', commercial: { rentPrice }, area });
const nightly = (nightlyRate: number): Unit =>
  ({ commercialStatus: 'unavailable', offerKinds: ['leaseShort'], commercial: { nightlyRate } });
const unpriced = (area?: number): Unit => ({ commercialStatus: 'for-sale', area });

const pricedSum = (t: PriceTotalsByRole): number =>
  PRICE_ROLES.reduce((n, role) => n + t.byRole[role].pricedCount, 0);

// =============================================================================
// Α — Η ΚΑΡΔΙΑ: ανόμοιες μονάδες δεν αθροίζονται
// =============================================================================

describe('🔴 Α. ΑΝΟΜΟΙΕΣ ΜΟΝΑΔΕΣ ΔΕΝ ΑΘΡΟΙΖΟΝΤΑΙ', () => {
  // Τα ποσά διαλέχτηκαν ώστε ο ΕΝΑΣ αριθμός (2.430.550) να διαφέρει από ΚΑΘΕ υποσύνολο.
  const PORTFOLIO: readonly Unit[] = [sale(1_230_000), sale(1_200_000), rent(500), nightly(50)];

  it('Α1 — το περιστατικό: η πώληση ΔΕΝ περιέχει ενοίκιο ούτε διανυκτέρευση', () => {
    const totals = totalPriceByRole(PORTFOLIO);
    expect(totals.byRole.sale.total).toBe(2_430_000);
    expect(totals.byRole.rent.total).toBe(500);
    expect(totals.byRole.nightly.total).toBe(50);
    // ο αριθμός της παλιάς «Συνολικής Αξίας» δεν εμφανίζεται ΠΟΥΘΕΝΑ
    for (const role of PRICE_ROLES) {
      expect(totals.byRole[role].total).not.toBe(2_430_550);
    }
  });

  it('Α2 — ο τύπος ΔΕΝ έχει ενιαίο `total`: όποιος θέλει αριθμό ονομάζει τη μονάδα', () => {
    const totals = totalPriceByRole(PORTFOLIO) as unknown as Record<string, unknown>;
    expect(Object.keys(totals).sort()).toEqual(['byRole', 'unpricedCount']);
    expect(Object.keys(totals.byRole as object).sort()).toEqual([...PRICE_ROLES].sort());
  });

  it('Α3 — ο μέσος όρος είναι ΜΕΣΑ στον ρόλο (όχι 2.430.550 / 4)', () => {
    const totals = totalPriceByRole(PORTFOLIO);
    expect(totals.byRole.sale.average).toBe(1_215_000);
    expect(totals.byRole.rent.average).toBe(500);
  });

  it('Α4 — η λογιστική ΚΛΕΙΝΕΙ για κάθε σχήμα: Σ ρόλων + χωρίς τιμή = πλήθος', () => {
    const shapes: readonly (readonly Unit[])[] = [
      [], PORTFOLIO, [unpriced(), unpriced()], [nightly(0)], [rent(0), sale(0), {}],
      [...PORTFOLIO, unpriced(), { commercialStatus: 'sold', commercial: { finalPrice: 90_000 } }],
    ];
    for (const shape of shapes) {
      const totals = totalPriceByRole(shape);
      expect(pricedSum(totals) + totals.unpricedCount).toBe(shape.length);
    }
  });

  it('Α5 — ο επιλυτής ρωτιέται ΜΙΑ φορά ανά μονάδα (ένα πέρασμα, όχι ένα ανά ρόλο)', () => {
    const spy = jest.mocked(resolveDisplayPrice);
    spy.mockClear();
    totalPriceByRole(PORTFOLIO, (u) => u.area);
    expect(spy).toHaveBeenCalledTimes(PORTFOLIO.length);
  });
});

// =============================================================================
// Β — €/m²: αριθμητής και παρονομαστής από το ΙΔΙΟ σύνολο
// =============================================================================

describe('🔴 Β. ΤΙΜΗ ΑΝΑ ΤΕΤΡΑΓΩΝΙΚΟ — ίδιο σύνολο πάνω και κάτω', () => {
  it('Β1 — μονάδα χωρίς τιμή ΔΕΝ ρίχνει το €/m² (το παλιό ελάττωμα των σελίδων πωλήσεων)', () => {
    const totals = totalPriceByRole([sale(200_000, 100), unpriced(300)], (u) => u.area);
    // παλιό: 200.000 / 400 = 500 €/m² — μια τιμή που ΚΑΝΕΝΑ ακίνητο δεν ζητά
    expect(totals.byRole.sale.perArea).toEqual({ amount: 2_000, measuredCount: 1 });
  });

  it('Β2 — τιμή χωρίς εμβαδόν μετρά στο άθροισμα, ΟΧΙ στο €/m²', () => {
    const totals = totalPriceByRole([sale(200_000, 100), sale(900_000)], (u) => u.area);
    expect(totals.byRole.sale.total).toBe(1_100_000);
    expect(totals.byRole.sale.perArea).toEqual({ amount: 2_000, measuredCount: 1 });
  });

  it('Β3 — το €/m² είναι ΑΝΑ ΡΟΛΟ: ενοίκιο ανά m² δεν ανακατεύεται με πώληση ανά m²', () => {
    const totals = totalPriceByRole([sale(200_000, 100), rent(900, 100)], (u) => u.area);
    expect(totals.byRole.sale.perArea?.amount).toBe(2_000);
    expect(totals.byRole.rent.perArea?.amount).toBe(9);
  });

  it('Β4 — χωρίς `areaOf`, κανένα €/m² (όχι μηδέν, όχι NaN)', () => {
    const totals = totalPriceByRole([sale(200_000, 100)]);
    expect(totals.byRole.sale.perArea).toBeNull();
  });

  it('Β5 — μη χρησιμοποιήσιμο εμβαδόν (0, αρνητικό, NaN) = «άγνωστο»', () => {
    const units = [sale(1, 0), sale(1, -5), sale(1, Number.NaN)];
    expect(totalPriceByRole(units, (u) => u.area).byRole.sale.perArea).toBeNull();
  });
});

// =============================================================================
// Γ — αναγνώσεις και λεξιλόγιο
// =============================================================================

describe('Γ. ΑΝΑΓΝΩΣΕΙΣ ΚΑΙ ΛΕΞΙΛΟΓΙΟ', () => {
  it('Γ1 — ρόλος με ΜΗΔΕΝ μονάδες δεν επιστρέφεται· η σειρά είναι η δηλωμένη', () => {
    expect(pricedRolesOf(totalPriceByRole([nightly(50), sale(1)]))).toEqual(['sale', 'nightly']);
    expect(pricedRolesOf(EMPTY_PRICE_TOTALS)).toEqual([]);
  });

  it('Γ2 — το `PRICE_ROLES` ΠΑΡΑΓΕΤΑΙ από το `PRICE_ROLE_ORDER` (μία δήλωση, όχι δύο)', () => {
    const byOrder = (Object.keys(PRICE_ROLE_ORDER) as PriceRole[])
      .sort((a, b) => PRICE_ROLE_ORDER[a] - PRICE_ROLE_ORDER[b]);
    expect(PRICE_ROLES).toEqual(byOrder);
    expect(PRICE_ROLES[0]).toBe('sale');
  });

  it('Γ3 — η zero value είναι μηδενική σε ΚΑΘΕ ρόλο', () => {
    for (const role of PRICE_ROLES) {
      expect(EMPTY_PRICE_TOTALS.byRole[role]).toEqual({ total: 0, average: 0, pricedCount: 0, perArea: null });
    }
    expect(EMPTY_PRICE_TOTALS.unpricedCount).toBe(0);
  });
});
