/**
 * Άγκυρες — ADR-777 §8.60.14.13 (Φάση 3): **η κάρτα «Συνολική Αξία» γράφει υποσύνολα
 * ανά ρόλο, κάθε ποσό με τη ΔΙΚΗ ΤΟΥ μονάδα.**
 *
 * Ο `t` εδώ είναι **καταγραφέας**: επιστρέφει `κλειδί|παράμετροι`, ώστε να κρίνεται το
 * **κλειδί** και όχι η ύπαρξη κειμένου (μάθημα Φάσης 2: ο `criterionLabel` δεν σκάει σε
 * άγνωστο κλειδί). Η ύπαρξη στα πραγματικά locales κρίνεται χωριστά (Ε).
 */
import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { PRICE_ROLES, type PricedPropertyLike } from '@/lib/properties/price-resolver';
import { totalPriceByRole } from '@/lib/properties/price-totals';
import {
  NO_PRICE_TOTAL,
  priceTotalsSentence,
  priceTotalsView,
  type PriceLabelT,
} from '../listing-price-label';
import { PRICE_AMOUNT_KEY, PRICE_PER_AREA_KEY, PRICE_SECTION_KEY } from '../listing-price-keys';

interface Unit extends PricedPropertyLike {
  readonly area?: number;
}

const sale = (askingPrice: number, area?: number): Unit =>
  ({ commercialStatus: 'for-sale', commercial: { askingPrice }, area });
const rent = (rentPrice: number, area?: number): Unit =>
  ({ commercialStatus: 'for-rent', commercial: { rentPrice }, area });
const nightly = (nightlyRate: number): Unit =>
  ({ commercialStatus: 'unavailable', offerKinds: ['leaseShort'], commercial: { nightlyRate } });
const unpriced = (): Unit => ({ commercialStatus: 'for-sale' });

/** `κλειδί|{"count":2}` — το ποσό αντικαθίσταται με `#`, για να μην κρίνεται η μορφή του locale. */
const t: PriceLabelT = (key, options) => {
  const { price, ...rest } = options ?? {};
  const params = price === undefined ? rest : { ...rest, price: '#' };
  return Object.keys(params).length > 0 ? `${key}|${JSON.stringify(params)}` : key;
};
const keyOf = (text: string | null): string | null => (text === null ? null : text.split('|')[0]);

const totals = (units: readonly Unit[]) => totalPriceByRole(units, (u) => u.area);

// =============================================================================
// Α — μία κλάση: ένα ποσό, χωρίς επιγραφή
// =============================================================================

describe('Α. ΜΙΑ ΚΛΑΣΗ ⇒ ΕΝΑ ΠΟΣΟ, ΧΩΡΙΣ ΕΠΙΓΡΑΦΗ (όπως τα τμήματα της λίστας)', () => {
  it('Α1 — μόνο πωλήσεις: η οθόνη μένει ένα ποσό — τώρα ΜΕ τη μονάδα του ρόλου', () => {
    const view = priceTotalsView(t, totals([sale(100_000), sale(200_000)]), 'total');
    expect(view.priceBreakdown).toEqual([]);
    expect(keyOf(view.value)).toBe(PRICE_AMOUNT_KEY.sale);
  });

  it('🔴 Α2 — μόνο ενοίκια: γράφει «/μήνα» — πριν διαβαζόταν «€3K», σαν τιμή πώλησης', () => {
    const view = priceTotalsView(t, totals([rent(900), rent(500)]), 'total');
    expect(view.priceBreakdown).toEqual([]);
    expect(keyOf(view.value)).toBe(PRICE_AMOUNT_KEY.rent);
  });

  it('Α3 — τίποτα με τιμή: η απουσία είναι σύμβολο, ποτέ «0 €»', () => {
    expect(priceTotalsView(t, totals([]), 'total').value).toBe(NO_PRICE_TOTAL);
    expect(priceTotalsView(t, totals([unpriced()]), 'total').value).toBe(NO_PRICE_TOTAL);
  });
});

// =============================================================================
// Β — δύο κλάσεις και πάνω: υποσύνολα
// =============================================================================

describe('🔴 Β. ΔΥΟ ΚΛΑΣΕΙΣ ΚΑΙ ΠΑΝΩ ⇒ ΥΠΟΣΥΝΟΛΑ (Revit «Title, count, and totals»)', () => {
  const MIXED = [sale(1_230_000), sale(1_200_000), rent(500), nightly(50), unpriced()];

  it('Β1 — μία γραμμή ανά κλάση, στη δηλωμένη σειρά, με την απουσία ΤΕΛΕΥΤΑΙΑ', () => {
    const view = priceTotalsView(t, totals(MIXED), 'total');
    expect(view.value).toBe('');
    expect(view.priceBreakdown.map((row) => row.key)).toEqual(['sale', 'rent', 'nightly', 'unpriced']);
  });

  it('🔴 Β2 — κάθε ποσό με τη ΔΙΚΗ ΤΟΥ μονάδα — ποτέ ένα κλειδί για όλα', () => {
    const view = priceTotalsView(t, totals(MIXED), 'total');
    const byKey = Object.fromEntries(view.priceBreakdown.map((row) => [row.key, keyOf(row.value)]));
    expect(byKey).toEqual({
      sale: PRICE_AMOUNT_KEY.sale,
      rent: PRICE_AMOUNT_KEY.rent,
      nightly: PRICE_AMOUNT_KEY.nightly,
      unpriced: null,
    });
  });

  it('Β3 — η επιγραφή ΜΕΤΡΑ: ποια κλάση και πόσες μονάδες καλύπτει', () => {
    const view = priceTotalsView(t, totals(MIXED), 'total');
    expect(view.priceBreakdown.map((row) => row.label)).toEqual([
      `${PRICE_SECTION_KEY.sale}|{"count":2}`,
      `${PRICE_SECTION_KEY.rent}|{"count":1}`,
      `${PRICE_SECTION_KEY.nightly}|{"count":1}`,
      `${PRICE_SECTION_KEY.unpriced}|{"count":1}`,
    ]);
  });

  it('Β4 — ρόλος με μηδέν μονάδες ΔΕΝ τυπώνεται («Βραχυχρόνια: 0 €» είναι θόρυβος)', () => {
    const view = priceTotalsView(t, totals([sale(1), rent(1)]), 'total');
    expect(view.priceBreakdown.map((row) => row.key)).toEqual(['sale', 'rent']);
  });

  it('🔴 Β5 — ένας ρόλος + μονάδες χωρίς τιμή ⇒ υποσύνολα: το άθροισμα λέει ΠΟΣΟ καλύπτει', () => {
    const view = priceTotalsView(t, totals([sale(1), unpriced(), unpriced()]), 'total');
    expect(view.priceBreakdown.map((row) => row.key)).toEqual(['sale', 'unpriced']);
    expect(view.priceBreakdown[1].label).toBe(`${PRICE_SECTION_KEY.unpriced}|{"count":2}`);
  });

  it('Β6 — η πρόταση για αναγνώστη οθόνης κρατά ΚΑΘΕ ποσό στη γραμμή του', () => {
    const sentence = priceTotalsSentence(priceTotalsView(t, totals(MIXED), 'total'));
    expect(sentence.split(' · ')).toHaveLength(4);
    expect(sentence).toContain(PRICE_AMOUNT_KEY.rent);
  });
});

// =============================================================================
// Γ — μέσος όρος και €/m²
// =============================================================================

describe('Γ. ΜΕΣΟΣ ΟΡΟΣ ΚΑΙ €/m²', () => {
  it('Γ1 — ο μέσος όρος στρογγυλεύεται σε ακέραιο ευρώ (όχι «202.500,33 €»)', () => {
    const spy = jest.fn(t);
    priceTotalsView(spy, totals([sale(100_000), sale(100_000), sale(100_001)]), 'average');
    const call = spy.mock.calls.find(([key]) => key === PRICE_AMOUNT_KEY.sale);
    expect(call?.[1]?.price).toMatch(/100[.,\s ]?000/);
    expect(String(call?.[1]?.price)).not.toMatch(/,33|\.33/);
  });

  it('🔴 Γ2 — το €/m² ζητά το ΔΙΚΟ ΤΟΥ κλειδί ανά ρόλο («/m²/μήνα», όχι σκέτο «€/τ.μ.»)', () => {
    const view = priceTotalsView(t, totals([sale(200_000, 100), rent(900, 100)]), 'perArea');
    expect(view.priceBreakdown.map((row) => keyOf(row.value))).toEqual([
      PRICE_PER_AREA_KEY.sale,
      PRICE_PER_AREA_KEY.rent,
    ]);
  });

  it('Γ3 — στο €/m² η επιγραφή μετρά όσες έχουν ΚΑΙ εμβαδόν, όχι όσες έχουν τιμή', () => {
    const view = priceTotalsView(t, totals([sale(1, 10), sale(1), rent(1, 5)]), 'perArea');
    expect(view.priceBreakdown[0].label).toBe(`${PRICE_SECTION_KEY.sale}|{"count":1}`);
  });
});

// =============================================================================
// Ε — τα κλειδιά ΥΠΑΡΧΟΥΝ στα πραγματικά locales
// =============================================================================

describe('🔴 Ε. ΤΑ ΚΛΕΙΔΙΑ ΛΥΝΟΝΤΑΙ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ el ΚΑΙ en', () => {
  type Locale = Record<string, unknown>;
  const lookup = (locale: Locale, key: string): unknown =>
    (key.split(':')[1] ?? key)
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);

  it('Ε1 — κάθε κλειδί €/m² υπάρχει και φέρει `{price}` και `m²`', () => {
    for (const role of PRICE_ROLES) {
      for (const locale of [elCommon as Locale, enCommon as Locale]) {
        const text = lookup(locale, PRICE_PER_AREA_KEY[role]);
        expect(typeof text).toBe('string');
        expect(String(text)).toContain('{price}');
        expect(String(text)).toContain('m²');
      }
    }
  });

  it('Ε2 — τρεις ρόλοι, τρία ΔΙΑΦΟΡΕΤΙΚΑ κείμενα €/m² (η μονάδα ξεχωρίζει)', () => {
    for (const locale of [elCommon as Locale, enCommon as Locale]) {
      const texts = PRICE_ROLES.map((role) => lookup(locale, PRICE_PER_AREA_KEY[role]));
      expect(new Set(texts).size).toBe(PRICE_ROLES.length);
    }
  });
});
