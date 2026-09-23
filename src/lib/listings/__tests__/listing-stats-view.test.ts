/**
 * @fileoverview ΑΓΚΥΡΑ — **οι αναγνώσεις των στατιστικών για την οθόνη** (ADR-777 §8.72 Φάση 2).
 * @related lib/listings/listing-stats-view.ts
 *
 *   Τ1 · η τάση συγκρίνει ΜΕΣΟΥΣ ΟΡΟΥΣ ανά μετρημένη ημέρα (Rightmove), όχι σύνολα.
 *   Τ2 · λιγότερες από 3 μετρημένες ημέρες στην προηγούμενη περίοδο ⇒ `partial`, ΚΑΝΕΝΑ ποσοστό.
 *   Τ3 · άγνωστες προβολές ⇒ `null` (ποτέ «σταθερή»).
 *   Λ1 · ο λόγος επαφών/προβολών μετρά ΚΑΙ τα δύο στις ίδιες μετρημένες ημέρες.
 *   Λ2 · κάτω από 100 προβολές ⇒ `insufficient` με τους αριθμούς· άγνωστη πηγή ⇒ `unknown`.
 *   Γ1 · πριν το `countingSince` ⇒ προβολές `null`, μετά ⇒ 0 για απούσα μέρα.
 *   Γ2 · οι ΕΠΑΦΕΣ δεν έχουν «πριν»: είναι γνωστές κάθε ημέρα (ζωντανό εύρημα §8.72.8 — «Επαφές: 1»
 *        πάνω από άδεια ζώνη).
 *   Π1 · οι προβολές ενός εύρους λένε τις ΜΕΤΡΗΜΕΝΕΣ ημέρες· καμία ⇒ `not-yet`, ΠΟΤΕ «0 σε 7 ημέρες».
 *   Ε1 · γεγονότα τιμής: καταχώριση · μείωση με μονάδες βάσης · απόσυρση · επαναδημοσίευση.
 *   Ε2 · αλλαγή ρόλου ΔΕΝ είναι μείωση· σκουπίδι ⇒ κανένα γεγονός.
 */

import {
  cardViewsReading,
  comparableViewTrend,
  contactRateIn,
  countedDaysIn,
  listingPriceEvents,
  listingStatsDays,
  priceEventsIn,
  viewsIn,
} from '../listing-stats-view';
import type { ListingStatsSummary, ListingViewDaily } from '../listing-stats';

const TODAY = '2026-10-20';

function summary(over: Partial<ListingStatsSummary> = {}): ListingStatsSummary {
  return {
    propertyId: 'ownp_1',
    countingSince: '2026-09-24',
    views: { lastWindow: 0, previousWindow: 0, total: 0, daily: {} },
    contacts: { total: 0, lastWindow: 0, daily: {} },
    saves: { total: 0, lastWindow: 0, daily: {} },
    ...over,
  };
}

function views(lastWindow: number, previousWindow: number, daily: ListingViewDaily = {}): ListingStatsSummary['views'] {
  return { lastWindow, previousWindow, total: lastWindow + previousWindow, daily };
}

describe('Τ — η τάση της κάρτας', () => {
  it('Τ1 · πλήρεις εβδομάδες: 70 έναντι 50 ⇒ +40%', () => {
    const trend = comparableViewTrend(summary({ views: views(70, 50) }), TODAY);
    expect(trend).toEqual({ kind: 'up', ratio: expect.closeTo(0.4, 5) });
  });

  it('Τ1 · μισή προηγούμενη εβδομάδα: ίδιος μέσος όρος ⇒ ΣΤΑΘΕΡΗ, όχι «+133%»', () => {
    // Μετράμε από 2026-10-10: η προηγούμενη περίοδος (10-07..10-13) έχει 4 μετρημένες ημέρες.
    const trend = comparableViewTrend(summary({ countingSince: '2026-10-10', views: views(70, 40) }), TODAY);
    expect(trend?.kind).toBe('flat');
  });

  it('Τ2 · 2 μετρημένες ημέρες πριν ⇒ partial, κανένα ποσοστό', () => {
    const trend = comparableViewTrend(summary({ countingSince: '2026-10-12', views: views(70, 40) }), TODAY);
    expect(trend).toEqual({ kind: 'partial' });
  });

  it('Τ3 · άγνωστες προβολές ⇒ null', () => {
    expect(comparableViewTrend(summary({ views: null }), TODAY)).toBeNull();
  });

  it('countedDaysIn · εύρος πριν από τη μέτρηση ⇒ 0', () => {
    expect(countedDaysIn('2026-10-10', '2026-10-01', '2026-10-05')).toBe(0);
    expect(countedDaysIn('2026-10-03', '2026-10-01', '2026-10-05')).toBe(3);
  });
});

describe('Λ — επαφές ανά 1.000 προβολές', () => {
  it('Λ1 · επαφές ΠΡΙΝ τη μέτρηση προβολών δεν μπαίνουν στον αριθμητή', () => {
    const s = summary({
      countingSince: '2026-10-01',
      views: views(0, 0, { '2026-10-02': 150, '2026-10-03': 50 }),
      contacts: { total: 9, lastWindow: 0, daily: { '2026-09-25': 7, '2026-10-02': 2 } },
    });
    expect(contactRateIn(s, '2026-09-21', TODAY)).toEqual({ kind: 'rate', perThousand: 10, views: 200, contacts: 2 });
  });

  it('Λ2 · 40 προβολές ⇒ insufficient με τους αριθμούς', () => {
    const s = summary({ views: views(0, 0, { '2026-10-19': 40 }), contacts: { total: 1, lastWindow: 1, daily: { '2026-10-19': 1 } } });
    expect(contactRateIn(s, '2026-09-21', TODAY)).toEqual({ kind: 'insufficient', views: 40, contacts: 1 });
  });

  it('Λ2 · άγνωστες επαφές ⇒ unknown, ποτέ «0‰»', () => {
    expect(contactRateIn(summary({ contacts: null }), '2026-09-21', TODAY)).toEqual({ kind: 'unknown' });
  });
});

describe('Γ — οι ημέρες του γραφήματος', () => {
  it('Γ1 · πριν τη μέτρηση null, μετά 0 για απούσα ημέρα', () => {
    const s = summary({ countingSince: '2026-10-19', views: views(3, 0, { '2026-10-20': 3 }) });
    const days = listingStatsDays(s, TODAY, 30);
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ day: '2026-09-21', views: null, contacts: 0, saves: 0 });
    expect(days[28]).toEqual({ day: '2026-10-19', views: 0, contacts: 0, saves: 0 });
    expect(days[29]).toEqual({ day: '2026-10-20', views: 3, contacts: 0, saves: 0 });
  });

  it('Γ1 · άγνωστη πηγή ⇒ null σε κάθε ημέρα της, η άλλη πηγή ανέγγιχτη', () => {
    const days = listingStatsDays(summary({ countingSince: '2026-10-01', contacts: null }), TODAY, 30);
    expect(days[29]).toEqual({ day: TODAY, views: 0, contacts: null, saves: 0 });
  });
});

describe('Γ2 — οι επαφές είναι γνωστές πριν από τη μέτρηση προβολών', () => {
  it('Γ2 · επαφή πριν το countingSince ⇒ μετριέται στη ζώνη της', () => {
    const s = summary({ countingSince: '2026-10-19', contacts: { total: 1, lastWindow: 0, daily: { '2026-10-01': 1 } } });
    const day = listingStatsDays(s, TODAY, 30).find((d) => d.day === '2026-10-01');
    expect(day).toEqual({ day: '2026-10-01', views: null, contacts: 1, saves: 0 });
  });
});

describe('Γ3 — οι αποθηκεύσεις (§8.74): γνωστές κάθε ημέρα, άγνωστη πηγή ⇒ null', () => {
  it('Γ3 · αποθήκευση πριν το countingSince ⇒ μετριέται· βλάβη ⇒ null παντού, οι άλλες πηγές ανέγγιχτες', () => {
    const known = summary({ countingSince: '2026-10-19', saves: { total: 2, lastWindow: 0, daily: { '2026-10-01': 2 } } });
    expect(listingStatsDays(known, TODAY, 30).find((d) => d.day === '2026-10-01')?.saves).toBe(2);
    const failed = listingStatsDays(summary({ saves: null }), TODAY, 30);
    expect(failed.every((d) => d.saves === null)).toBe(true);
    expect(failed[29]?.contacts).toBe(0);
  });
});

describe('Π — οι προβολές ενός εύρους', () => {
  it('Π1 · καμία μετρημένη ημέρα ⇒ not-yet, κανένας αριθμός', () => {
    expect(cardViewsReading(summary({ countingSince: '2026-10-21' }), TODAY)).toEqual({ kind: 'not-yet', countingSince: '2026-10-21' });
  });

  it('Π1 · 3 μετρημένες από τις 7 ⇒ λέει 3 ημέρες', () => {
    const s = summary({ countingSince: '2026-10-18', views: views(12, 0, { '2026-10-18': 5, '2026-10-20': 7 }) });
    expect(cardViewsReading(s, TODAY)).toEqual({ kind: 'counted', views: 12, days: 3 });
  });

  it('Π1 · όλο το εύρος μετρημένο ⇒ όλες οι ημέρες· άγνωστη πηγή ⇒ unknown', () => {
    const s = summary({ countingSince: '2026-09-01', views: views(9, 0, { '2026-10-01': 4, '2026-10-20': 5 }) });
    expect(viewsIn(s, '2026-09-21', TODAY)).toEqual({ kind: 'counted', views: 9, days: 30 });
    expect(viewsIn(summary({ views: null }), '2026-09-21', TODAY)).toEqual({ kind: 'unknown' });
  });
});

describe('Ε — τα γεγονότα τιμής', () => {
  const sale = (amount: number) => ({ role: 'sale' as const, amount });

  it('Ε1 · καταχώριση → μείωση → απόσυρση → επαναδημοσίευση', () => {
    const events = listingPriceEvents([
      { at: '2026-10-01T09:00:00.000Z', price: sale(300_000) },
      { at: '2026-10-10T09:00:00.000Z', price: sale(276_000) },
      { at: '2026-10-12T09:00:00.000Z', price: null },
      { at: '2026-10-15T09:00:00.000Z', price: sale(270_000) },
    ]);
    expect(events.map((e) => [e.day, e.kind, e.changeBasisPoints])).toEqual([
      ['2026-10-01', 'listed', null],
      ['2026-10-10', 'reduced', -800],
      ['2026-10-12', 'withdrawn', null],
      ['2026-10-15', 'relisted', null],
    ]);
  });

  it('Ε2 · πώληση → ενοικίαση δεν είναι μείωση· σκουπίδι ⇒ τίποτα', () => {
    const events = listingPriceEvents([
      { at: '2026-10-01T09:00:00.000Z', price: sale(300_000) },
      { at: '2026-10-05T09:00:00.000Z', price: { role: 'rent', amount: 900 } },
    ]);
    expect(events[1]).toMatchObject({ kind: 'listed', changeBasisPoints: null });
    expect(listingPriceEvents('not-a-history')).toEqual([]);
  });

  it('Ε · η ημέρα του γεγονότος είναι ώρα Αθήνας (23:30 UTC καλοκαίρι = επόμενη μέρα)', () => {
    const [event] = listingPriceEvents([{ at: '2026-08-10T23:30:00.000Z', price: sale(1) }]);
    expect(event.day).toBe('2026-08-11');
  });

  it('priceEventsIn · μόνο όσα πέφτουν μέσα στο εύρος', () => {
    const events = listingPriceEvents([
      { at: '2026-01-01T09:00:00.000Z', price: sale(300_000) },
      { at: '2026-10-10T09:00:00.000Z', price: sale(290_000) },
    ]);
    const days = listingStatsDays(summary(), TODAY, 30);
    expect(priceEventsIn(events, days).map((e) => e.kind)).toEqual(['reduced']);
  });
});
