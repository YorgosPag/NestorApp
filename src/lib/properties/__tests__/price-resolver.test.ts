/**
 * Unit tests — property price resolver (ADR-777 Α6, rules 9 & 18).
 *
 * Κ-anchors below pin the ORIGINAL defect, not a synthetic one: a property
 * whose price lives in `commercial.askingPrice` (the canonical field since
 * ADR-197) rendered "contact us", because the card asked the `@deprecated`
 * flat `price` field instead. Every regression here must stay red if the
 * resolver ever stops answering that shape.
 */
import {
  resolveDisplayPrice,
  getEffectivePrice,
  totalPrice,
  priceSortKey,
  type PricedPropertyLike,
} from '@/lib/properties/price-resolver';
import { compareSortValues } from '@/lib/array-utils';

/** Minimal builder — nothing is defaulted that the resolver reads. */
function unit(p: PricedPropertyLike): PricedPropertyLike {
  return p;
}

// =============================================================================
// Κ1 — THE ORIGINAL DEFECT
// =============================================================================

describe('Κ1 — modern data (askingPrice only) must resolve', () => {
  it('resolves a for-sale unit priced only in commercial.askingPrice', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 185000 } }),
    );

    expect(result).toEqual({
      kind: 'priced',
      headline: { role: 'sale', amount: 185000, source: 'commercial.askingPrice' },
      secondary: null,
    });
  });

  it('never returns `missing` when a positive askingPrice exists', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 1 } }),
    );
    expect(result.kind).toBe('priced');
  });
});

// =============================================================================
// Κ2 — PROVENANCE (rule 18: a number without an origin is a claim)
// =============================================================================

describe('Κ2 — every amount declares where it came from', () => {
  it('tags the canonical field', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 100 } }),
    );
    expect(result.kind === 'priced' && result.headline.source).toBe('commercial.askingPrice');
  });

  it('tags the legacy field when it is the only source', () => {
    const result = resolveDisplayPrice(unit({ commercialStatus: 'for-sale', price: 99000 }));
    expect(result.kind === 'priced' && result.headline.source).toBe('legacy.price');
  });

  it('tags finalPrice when askingPrice is absent', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'sold', commercial: { finalPrice: 210000 } }),
    );
    expect(result.kind === 'priced' && result.headline.source).toBe('commercial.finalPrice');
  });

  it('prefers the canonical field over the legacy one', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 200 }, price: 100 }),
    );
    expect(result.kind === 'priced' && result.headline).toEqual({
      role: 'sale',
      amount: 200,
      source: 'commercial.askingPrice',
    });
  });
});

// =============================================================================
// Κ3 — RENT IS NOT SALE
// =============================================================================

describe('Κ3 — rent statuses resolve the rent, never the sale price', () => {
  it.each(['for-rent', 'rented'])('%s reads commercial.rentPrice', (status) => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: status, commercial: { rentPrice: 750, askingPrice: 300000 } }),
    );
    expect(result).toEqual({
      kind: 'priced',
      headline: { role: 'rent', amount: 750, source: 'commercial.rentPrice' },
      secondary: null,
    });
  });

  it('does NOT fall back to the sale price when the rent is missing', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-rent', commercial: { askingPrice: 300000 } }),
    );
    expect(result).toEqual({ kind: 'missing', reason: 'rent-price-missing' });
  });
});

// =============================================================================
// Κ4 — DUAL LISTING KEEPS BOTH HALVES
// =============================================================================

describe('Κ4 — for-sale-and-rent never silently drops half the offer', () => {
  it('returns sale as headline and rent as secondary', () => {
    const result = resolveDisplayPrice(
      unit({
        commercialStatus: 'for-sale-and-rent',
        commercial: { askingPrice: 240000, rentPrice: 900 },
      }),
    );
    expect(result).toEqual({
      kind: 'priced',
      headline: { role: 'sale', amount: 240000, source: 'commercial.askingPrice' },
      secondary: { role: 'rent', amount: 900, source: 'commercial.rentPrice' },
    });
  });

  it('falls back to the rent as headline when only the rent exists', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale-and-rent', commercial: { rentPrice: 900 } }),
    );
    expect(result).toEqual({
      kind: 'priced',
      headline: { role: 'rent', amount: 900, source: 'commercial.rentPrice' },
      secondary: null,
    });
  });

  it('reports a sale gap when neither price exists', () => {
    const result = resolveDisplayPrice(unit({ commercialStatus: 'for-sale-and-rent' }));
    expect(result).toEqual({ kind: 'missing', reason: 'sale-price-missing' });
  });
});

// =============================================================================
// Κ5 — ABSENCE IS NAMED, AND THE NAMES ARE NOT INTERCHANGEABLE
// =============================================================================

describe('Κ5 — the three absences stay distinct', () => {
  it('off the market → not-listed (absence is correct, not a gap)', () => {
    expect(resolveDisplayPrice(unit({ commercialStatus: 'unavailable' }))).toEqual({
      kind: 'missing',
      reason: 'not-listed',
    });
  });

  it('listed for sale with no price → sale-price-missing (a closable gap)', () => {
    expect(resolveDisplayPrice(unit({ commercialStatus: 'for-sale' }))).toEqual({
      kind: 'missing',
      reason: 'sale-price-missing',
    });
  });

  it('listed for rent with no price → rent-price-missing', () => {
    expect(resolveDisplayPrice(unit({ commercialStatus: 'for-rent' }))).toEqual({
      kind: 'missing',
      reason: 'rent-price-missing',
    });
  });

  it('a sold unit with no recorded price is a gap, not "off the market"', () => {
    expect(resolveDisplayPrice(unit({ commercialStatus: 'sold' }))).toEqual({
      kind: 'missing',
      reason: 'sale-price-missing',
    });
  });

  it('no status at all → not-listed', () => {
    expect(resolveDisplayPrice(unit({}))).toEqual({ kind: 'missing', reason: 'not-listed' });
  });
});

// =============================================================================
// Κ6 — ZERO IS NOT A PRICE
// =============================================================================

describe('Κ6 — falsy and non-finite amounts never become a displayed price', () => {
  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s askingPrice is rejected', (_label, amount) => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: amount } }),
    );
    expect(result).toEqual({ kind: 'missing', reason: 'sale-price-missing' });
  });

  it('skips a zero askingPrice and uses the next positive candidate', () => {
    const result = resolveDisplayPrice(
      unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 0, finalPrice: 150000 } }),
    );
    expect(result.kind === 'priced' && result.headline.source).toBe('commercial.finalPrice');
  });

  it('null commercial does not throw', () => {
    expect(() =>
      resolveDisplayPrice(unit({ commercialStatus: 'for-sale', commercial: null })),
    ).not.toThrow();
  });
});

// =============================================================================
// Κ7 — LEGACY `status` STILL DRIVES THE RULE WHEN commercialStatus IS ABSENT
// =============================================================================

describe('Κ7 — legacy status is honoured as a fallback', () => {
  it('legacy for-rent resolves the rent', () => {
    const result = resolveDisplayPrice(
      unit({ status: 'for-rent', commercial: { rentPrice: 600 } }),
    );
    expect(result.kind === 'priced' && result.headline.role).toBe('rent');
  });

  it('commercialStatus wins over a contradicting legacy status', () => {
    const result = resolveDisplayPrice(
      unit({
        commercialStatus: 'for-sale',
        status: 'for-rent',
        commercial: { askingPrice: 120000, rentPrice: 500 },
      }),
    );
    expect(result.kind === 'priced' && result.headline.role).toBe('sale');
  });
});

// =============================================================================
// Κ8 — THE LEGACY SURFACE STAYS INTACT (2 existing callers)
// =============================================================================

describe('Κ8 — getEffectivePrice remains a faithful projection', () => {
  it('projects the headline amount and mode', () => {
    expect(
      getEffectivePrice(unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 185000 } })),
    ).toEqual({ amount: 185000, mode: 'sale' });
  });

  it('projects rent mode', () => {
    expect(
      getEffectivePrice(unit({ commercialStatus: 'for-rent', commercial: { rentPrice: 750 } })),
    ).toEqual({ amount: 750, mode: 'rent' });
  });

  it('returns null for every missing variant', () => {
    expect(getEffectivePrice(unit({ commercialStatus: 'unavailable' }))).toBeNull();
    expect(getEffectivePrice(unit({ commercialStatus: 'for-sale' }))).toBeNull();
    expect(getEffectivePrice(unit({ commercialStatus: 'for-rent' }))).toBeNull();
  });

  it('agrees with resolveDisplayPrice on every shape it is given', () => {
    const shapes: PricedPropertyLike[] = [
      { commercialStatus: 'for-sale', commercial: { askingPrice: 1000 } },
      { commercialStatus: 'for-rent', commercial: { rentPrice: 500 } },
      { commercialStatus: 'for-sale-and-rent', commercial: { askingPrice: 9, rentPrice: 8 } },
      { commercialStatus: 'sold', commercial: { finalPrice: 7 } },
      { commercialStatus: 'unavailable' },
      { status: 'for-sale', price: 42 },
      {},
    ];

    for (const shape of shapes) {
      const full = resolveDisplayPrice(shape);
      const projected = getEffectivePrice(shape);
      if (full.kind === 'priced') {
        expect(projected).toEqual({ amount: full.headline.amount, mode: full.headline.role });
      } else {
        expect(projected).toBeNull();
      }
    }
  });
});

// =============================================================================
// Κ9 — COLLECTIONS: the accounting must close, and absence must not be a zero
// =============================================================================

describe('Κ9 — totalPrice keeps a closed accounting', () => {
  const mixed: PricedPropertyLike[] = [
    { commercialStatus: 'for-sale', commercial: { askingPrice: 100_000 } },
    { commercialStatus: 'for-sale', commercial: { askingPrice: 200_000 } },
    { commercialStatus: 'for-sale' }, // listed, price never recorded
    { commercialStatus: 'unavailable' }, // off the market
  ];

  it('sums only the units that have a price', () => {
    expect(totalPrice(mixed).total).toBe(300_000);
  });

  it('divides the average by the PRICED units, not by all of them', () => {
    // The defect this pins: 300.000/4 = 75.000 would report an average that no
    // unit is offered at, because two units that have no price were counted as
    // costing nothing.
    expect(totalPrice(mixed).average).toBe(150_000);
  });

  it('reports both counts so the total can be read honestly', () => {
    const result = totalPrice(mixed);
    expect(result.pricedCount).toBe(2);
    expect(result.unpricedCount).toBe(2);
  });

  it('closes the accounting for EVERY shape it is given', () => {
    const shapes: PricedPropertyLike[][] = [
      [],
      mixed,
      [{ commercialStatus: 'for-rent', commercial: { rentPrice: 750 } }],
      [{ status: 'for-sale', price: 42 }, {}, { commercial: null }],
      [{ commercialStatus: 'for-sale', commercial: { askingPrice: 0 } }],
    ];
    for (const shape of shapes) {
      const result = totalPrice(shape);
      expect(result.pricedCount + result.unpricedCount).toBe(shape.length);
    }
  });

  it('reports zero — not NaN — when nothing in the set has a price', () => {
    const result = totalPrice([{ commercialStatus: 'unavailable' }, {}]);
    expect(result).toEqual({ total: 0, average: 0, pricedCount: 0, unpricedCount: 2 });
  });

  it('counts a rent-priced unit, because rent IS its price', () => {
    const result = totalPrice([{ commercialStatus: 'for-rent', commercial: { rentPrice: 750 } }]);
    expect(result).toEqual({ total: 750, average: 750, pricedCount: 1, unpricedCount: 0 });
  });
});

// =============================================================================
// Κ10 — ORDERING: "no price" is null, never zero
// =============================================================================

describe('Κ10 — priceSortKey', () => {
  it('returns the resolved amount, agreeing with getEffectivePrice', () => {
    const u = unit({ commercialStatus: 'for-sale', commercial: { askingPrice: 185_000 } });
    expect(priceSortKey(u)).toBe(185_000);
    expect(priceSortKey(u)).toBe(getEffectivePrice(u)?.amount);
  });

  it('returns null — NOT 0 — for a unit with no price', () => {
    // 0 would rank the unit as the cheapest one in the table.
    expect(priceSortKey(unit({ commercialStatus: 'for-sale' }))).toBeNull();
    expect(priceSortKey(unit({}))).toBeNull();
  });

  it('keeps unpriced units last in BOTH directions', () => {
    const rows: PricedPropertyLike[] = [
      { commercialStatus: 'for-sale' }, // no price
      { commercialStatus: 'for-sale', commercial: { askingPrice: 300 } },
      { commercialStatus: 'for-sale', commercial: { askingPrice: 100 } },
    ];
    const by = (dir: 'asc' | 'desc') =>
      [...rows]
        .sort((a, b) => compareSortValues(priceSortKey(a), priceSortKey(b), dir))
        .map(priceSortKey);

    expect(by('asc')).toEqual([100, 300, null]);
    expect(by('desc')).toEqual([300, 100, null]);
  });
});
