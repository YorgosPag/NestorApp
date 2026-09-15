/**
 * @fileoverview **Ο ΚΑΝΟΝΑΣ ΤΩΝ 30 ΗΜΕΡΩΝ, ΕΚΤΕΛΕΣΜΕΝΟΣ** — και τα κόλπα που οφείλει να αχρηστεύει.
 * @related ADR-777 §8.69 · lib/listings/price-history.ts
 *
 * 🔴 Η κρίσιμη ομάδα είναι η **Μ** (μείωση): κάθε άγκυρα εκεί είναι ένα σενάριο που ένα
 * portal *χωρίς* τον κανόνα Omnibus θα έβγαζε **ψεύτικο «↓%»** ή θα **έχανε** αληθινό.
 */

import { MS_PER_DAY } from '@/lib/date-local';
import type { PriceRole } from '@/lib/properties/price-resolver';
import type { PriceObservation } from '@/types/price-history';

import {
  PRICE_HISTORY_MAX_ENTRIES,
  PRICE_HISTORY_RETENTION_DAYS,
  isReductionFresh,
  marketPriceOf,
  nextPriceHistory,
  priceReductionOf,
  readPriceHistory,
  readPriceReduction,
  reductionForListing,
} from '../price-history';

const ORIGIN_MS = Date.UTC(2026, 7, 1);

/** Η στιγμή «ημέρα n» — μία πηγή χρόνου για όλη τη σουίτα. */
const day = (n: number): string => new Date(ORIGIN_MS + n * MS_PER_DAY).toISOString();

const priced = (n: number, amount: number, role: PriceRole = 'sale'): PriceObservation => ({
  at: day(n),
  price: { role, amount },
});

const offMarket = (n: number): PriceObservation => ({ at: day(n), price: null });

describe('Ε. Η ΕΓΓΡΑΦΗ — τι προστίθεται', () => {
  it('Ε1 — ακίνητο που δεν μπήκε ΠΟΤΕ στην αγορά δεν αποκτά ιστορικό', () => {
    expect(nextPriceHistory([], null, day(0))).toBeNull();
  });

  it('Ε2 — πρώτη δημοσίευση ⇒ μία παρατήρηση', () => {
    expect(nextPriceHistory([], { role: 'sale', amount: 200_000 }, day(0))).toEqual([priced(0, 200_000)]);
  });

  it('🔴 Ε3 — ΙΔΙΑ τιμή ⇒ `null` (καμία συναλλαγή, καμία εγγραφή)', () => {
    expect(nextPriceHistory([priced(0, 200_000)], { role: 'sale', amount: 200_000 }, day(5))).toBeNull();
  });

  it('Ε4 — ίδιο ποσό, ΑΛΛΟΣ ρόλος ⇒ νέα παρατήρηση', () => {
    const next = nextPriceHistory([priced(0, 900, 'rent')], { role: 'sale', amount: 900 }, day(1));
    expect(next).toHaveLength(2);
  });

  it('Ε5 — απόσυρση ⇒ παρατήρηση «εκτός αγοράς»· δεύτερη απόσυρση ⇒ τίποτα', () => {
    const withdrawn = nextPriceHistory([priced(0, 200_000)], null, day(3));
    expect(withdrawn?.at(-1)).toEqual(offMarket(3));
    expect(nextPriceHistory(withdrawn ?? [], null, day(4))).toBeNull();
  });

  it('🔴 Ε6 — πέρασμα ΠΑΛΑΙΟΤΕΡΟ από την τελευταία παρατήρηση ΔΕΝ ξαναγράφει την ιστορία', () => {
    expect(nextPriceHistory([priced(10, 200_000)], { role: 'sale', amount: 150_000 }, day(9))).toBeNull();
  });

  it('Ε7 — φράγμα πλήθους: ποτέ πάνω από το όριο εγγραφών', () => {
    let history: readonly PriceObservation[] = [];
    for (let n = 0; n < PRICE_HISTORY_MAX_ENTRIES + 10; n += 1) {
      history = nextPriceHistory(history, { role: 'sale', amount: 100_000 + n }, day(n)) ?? history;
    }
    expect(history).toHaveLength(PRICE_HISTORY_MAX_ENTRIES);
    expect(history.at(-1)?.price?.amount).toBe(100_000 + PRICE_HISTORY_MAX_ENTRIES + 9);
  });

  it('Ε8 — αποκοπή χρόνου: κρατιέται η τιμή που ΙΣΧΥΕ στο όριο, όχι μόνο οι νεότερες', () => {
    const late = PRICE_HISTORY_RETENTION_DAYS + 50;
    const next = nextPriceHistory([priced(0, 1), priced(10, 2)], { role: 'sale', amount: 3 }, day(late));
    expect(next).toEqual([priced(10, 2), priced(late, 3)]);
  });
});

describe('Μ. Η ΚΡΙΣΗ — ο κανόνας των 30 ημερών', () => {
  it('Μ1 — το email της idealista: 3.490.000 → 3.200.000 (−8,30%)', () => {
    expect(priceReductionOf([priced(0, 3_490_000), priced(12, 3_200_000)])).toEqual({
      role: 'sale',
      from: 3_490_000,
      to: 3_200_000,
      dropBasisPoints: 830,
      since: day(12),
    });
  });

  it('🏆 Μ2 — ΑΝΕΒΑΖΩ ΚΑΙ ΚΑΤΕΒΑΖΩ: 300.000 → 330.000 → 300.000 ⇒ ΚΑΜΙΑ μείωση', () => {
    expect(priceReductionOf([priced(0, 300_000), priced(10, 330_000), priced(20, 300_000)])).toBeNull();
  });

  it('Μ3 — ανεβάζω και κατεβάζω ΚΑΤΩ από την αρχική ⇒ αναφορά η ΧΑΜΗΛΟΤΕΡΗ', () => {
    const reduction = priceReductionOf([priced(0, 300_000), priced(10, 330_000), priced(20, 290_000)]);
    expect(reduction?.from).toBe(300_000);
    expect(reduction?.dropBasisPoints).toBe(333);
  });

  it('🔴 Μ4 — όριο 2%: 1,99% σιωπά, 2,00% μιλά', () => {
    expect(priceReductionOf([priced(0, 100_000), priced(1, 98_001)])).toBeNull();
    expect(priceReductionOf([priced(0, 100_000), priced(1, 98_000)])?.dropBasisPoints).toBe(200);
  });

  it('Μ5 — τιμή που ίσχυε ΠΡΙΝ το παράθυρο και ΣΥΝΕΧΙΖΕ μέσα του μετρά (ΔΕΕ ALDI SÜD)', () => {
    expect(priceReductionOf([priced(0, 300_000), priced(40, 280_000)])?.from).toBe(300_000);
  });

  it('🏆 Μ6 — ΑΠΟΣΥΡΣΗ: τιμή που έκλεισε με απόσυρση πριν 30+ ημέρες ΔΕΝ είναι «ήταν»', () => {
    expect(priceReductionOf([priced(0, 300_000), offMarket(5), priced(60, 280_000)])).toBeNull();
  });

  it('Μ7 — αλλαγή ρόλου (ενοίκιο → πώληση) δεν είναι μείωση', () => {
    expect(priceReductionOf([priced(0, 250_000, 'rent'), priced(10, 200_000, 'sale')])).toBeNull();
  });

  it('Μ8 — αύξηση ⇒ καμία μείωση', () => {
    expect(priceReductionOf([priced(0, 200_000), priced(5, 210_000)])).toBeNull();
  });

  it('Μ9 — τρέχουσα κατάσταση «εκτός αγοράς» ⇒ καμία μείωση', () => {
    expect(priceReductionOf([priced(0, 300_000), priced(5, 250_000), offMarket(6)])).toBeNull();
  });

  it('Μ10 — τιμή που ΕΠΑΨΕ να ισχύει πριν ανοίξει το παράθυρο δεν είναι αναφορά', () => {
    const reduction = priceReductionOf([priced(0, 400_000), priced(20, 300_000), priced(70, 290_000)]);
    // Το 400.000 έπαψε να ισχύει την ημέρα 20 — πριν ανοίξει το παράθυρο (ημέρα 40).
    // Αναφορά είναι το 300.000 (ίσχυε 20→70), ποτέ το 400.000: αλλιώς «↓27%» αντί για «↓3%».
    expect(reduction?.from).toBe(300_000);
    expect(reduction?.dropBasisPoints).toBe(333);
  });
});

describe('Π. Η ΠΡΟΒΟΛΗ — το δίχτυ της ίδιας τιμής', () => {
  const history = [priced(0, 3_490_000), priced(12, 3_200_000)];

  it('Π1 — η μείωση περνά όταν λέει την ΙΔΙΑ τιμή με την αγγελία', () => {
    const listing = { commercialStatus: 'for-sale', commercial: { askingPrice: 3_200_000 } };
    expect(reductionForListing(history, listing)?.to).toBe(3_200_000);
  });

  it('🔴 Π2 — ιστορικό ΠΙΣΩ από την αγγελία (αποτυχημένη σφραγίδα) ⇒ ΚΑΜΙΑ μείωση', () => {
    const listing = { commercialStatus: 'for-sale', commercial: { askingPrice: 3_100_000 } };
    expect(reductionForListing(history, listing)).toBeNull();
  });

  it('Π3 — ιστορικό-σκουπίδι ⇒ κενό ⇒ καμία μείωση', () => {
    expect(readPriceHistory('ναι')).toEqual([]);
    expect(reductionForListing([{ at: 'χθες', price: 5 }], { commercialStatus: 'for-sale' })).toBeNull();
  });

  it('Π4 — αναποδογυρισμένη σειρά διαβάζεται χρονολογικά', () => {
    expect(readPriceHistory([priced(12, 3_200_000), priced(0, 3_490_000)])).toEqual(history);
  });

  it('Π5 — μη δημόσια αγγελία ⇒ κατάσταση αγοράς «εκτός»', () => {
    const listing = { commercialStatus: 'for-sale', commercial: { askingPrice: 1 } };
    expect(marketPriceOf(listing, false)).toBeNull();
    expect(marketPriceOf(listing, true)).toEqual({ role: 'sale', amount: 1 });
  });

  it('Π6 — ο κριτής μορφής της δημόσιας μείωσης απορρίπτει μείωση κάτω από το κατώφλι', () => {
    const valid = priceReductionOf(history);
    expect(readPriceReduction(valid)).toEqual(valid);
    expect(readPriceReduction({ ...valid, dropBasisPoints: 150 })).toBeNull();
  });
});

describe('Φ. Η ΦΡΕΣΚΑΔΑ — 30 ημέρες σήμανσης', () => {
  const reduction = priceReductionOf([priced(0, 300_000), priced(10, 270_000)])!;

  it('Φ1 — την ημέρα 40 (30 μετά) δείχνεται ακόμη· μία στιγμή μετά, όχι', () => {
    expect(isReductionFresh(reduction, Date.parse(day(40)))).toBe(true);
    expect(isReductionFresh(reduction, Date.parse(day(40)) + 1)).toBe(false);
  });
});
