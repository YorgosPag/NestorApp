/**
 * ADR-777 §8.95.10 — **η φρεσκάδα των τιμών αναφοράς**: πόσες ημέρες μένουν ως τη μέρα που η εκτίμηση σβήνει.
 *
 * 🔑 Η άγκυρα Φ1 είναι η σημαντική: δένει την πύλη με τον **υπολογισμό**. Αν κάποιος ξαναγράψει το «πότε λήγει» σε
 * δεύτερο σημείο, η πύλη μπορεί να λέει «έχεις χρόνο» ενώ η οθόνη έχει ήδη αδειάσει — και αυτό το test κοκκινίζει.
 */

import { addDaysToDateKey } from '@/lib/calendar/date-key';
import type { FinalEnergyLine } from '@/lib/energy-certificate/certificate-final-energy';

import {
  energyPriceFreshness,
  FRESHNESS_ERROR_DAYS_LEFT,
  FRESHNESS_WARN_DAYS_LEFT,
  worstFreshnessLevel,
} from '../energy-price-freshness';
import { ENERGY_REFERENCE_PRICES, staleAfter, type EnergyReferencePrices } from '../energy-reference-prices';
import { listingEnergyCost, type EnergyCostSubject } from '../listing-energy-cost';

const NEWEST = '2026-S1';
const one = (period: string) => ({ periods: [{ period: '2025-S2', eurPerKwh: 0.2 }, { period, eurPerKwh: 0.25 }] });
const PRICES: EnergyReferencePrices = {
  generatedAt: '2026-10-13',
  sources: { electricity: one(NEWEST), oil: one(NEWEST), 'natural-gas': one(NEWEST) },
};
const EXPIRES = staleAfter(NEWEST) as string;
const dayAt = (daysLeft: number): string => addDaysToDateKey(EXPIRES, -daysLeft) as string;
const levelsAt = (today: string) => energyPriceFreshness(PRICES, today).map((row) => row.level);

describe('Φ0 — ποιες πηγές κρίνονται', () => {
  it('ΜΟΝΟ οι `priced` (ρεύμα · πετρέλαιο · αέριο) — ο ήλιος δεν λήγει', () => {
    expect(energyPriceFreshness(PRICES, '2026-10-13').map((row) => row.source).sort()).toEqual(
      ['electricity', 'natural-gas', 'oil'],
    );
  });
});

describe('Φ1 — η λήξη είναι Η ΙΔΙΑ ημέρα με το σβήσιμο της εκτίμησης', () => {
  const electric: EnergyCostSubject = {
    energyClass: 'C',
    energyCertificate: {
      primaryEnergy: null, co2Emissions: null, usefulArea: 100, scope: null, absence: null,
      finalEnergy: [{ source: 'electricity', perSqm: 20 }] as readonly FinalEnergyLine[],
    },
    commonCharges: null,
  };

  it('`expiresOn` = η τελευταία ημέρα που ο υπολογισμός ΒΓΑΖΕΙ ποσό· την επόμενη βγάζει stale-prices', () => {
    const row = energyPriceFreshness(PRICES, '2026-10-13').find((r) => r.source === 'electricity');
    expect(row?.expiresOn).toBe('2027-12-31');
    expect(listingEnergyCost(electric, PRICES, '2027-12-31').kind).toBe('estimated');
    expect(listingEnergyCost(electric, PRICES, '2028-01-01').kind).toBe('stale-prices');
  });
});

describe('Φ2 — τα όρια, στην ημέρα', () => {
  it(`> ${FRESHNESS_WARN_DAYS_LEFT} ημέρες ⇒ ok`, () => {
    expect(levelsAt(dayAt(FRESHNESS_WARN_DAYS_LEFT + 1))).toEqual(['ok', 'ok', 'ok']);
  });
  it(`${FRESHNESS_WARN_DAYS_LEFT} … ${FRESHNESS_ERROR_DAYS_LEFT + 1} ⇒ warn`, () => {
    expect(levelsAt(dayAt(FRESHNESS_WARN_DAYS_LEFT))).toEqual(['warn', 'warn', 'warn']);
    expect(levelsAt(dayAt(FRESHNESS_ERROR_DAYS_LEFT + 1))).toEqual(['warn', 'warn', 'warn']);
  });
  it(`🔴 ≤ ${FRESHNESS_ERROR_DAYS_LEFT} ⇒ error — και μετά τη λήξη αρνητικές ημέρες, ποτέ «ok»`, () => {
    expect(levelsAt(dayAt(FRESHNESS_ERROR_DAYS_LEFT))).toEqual(['error', 'error', 'error']);
    const after = energyPriceFreshness(PRICES, '2028-02-01')[0];
    expect(after.daysLeft).toBeLessThan(0);
    expect(after.level).toBe('error');
  });
});

describe('Φ3 — ό,τι δεν μετριέται είναι ❌, ποτέ σιωπηλό «περνά»', () => {
  it('🔴 πηγή `priced` που ΛΕΙΠΕΙ από τον πίνακα ⇒ error με newest = null', () => {
    const missingGas = { ...PRICES, sources: { electricity: one(NEWEST), oil: one(NEWEST) } };
    const gas = energyPriceFreshness(missingGas, '2026-10-13').find((row) => row.source === 'natural-gas');
    expect(gas).toEqual({ source: 'natural-gas', newest: null, expiresOn: null, daysLeft: null, level: 'error' });
  });
  it('🔴 άκυρο εξάμηνο ή άκυρη ημέρα ⇒ error', () => {
    const garbled = { ...PRICES, sources: { ...PRICES.sources, oil: one('2026-H1') } };
    expect(energyPriceFreshness(garbled, '2026-10-13').find((row) => row.source === 'oil')?.level).toBe('error');
    expect(levelsAt('13/10/2026')).toEqual(['error', 'error', 'error']);
  });
  it('η χειρότερη στάθμη κρίνει: μία ❌ ανάμεσα σε ok ⇒ error', () => {
    const mixed = { ...PRICES, sources: { ...PRICES.sources, oil: one('2025-S1') } };
    expect(worstFreshnessLevel(energyPriceFreshness(mixed, dayAt(FRESHNESS_WARN_DAYS_LEFT + 1)))).toBe('error');
  });
});

describe('Φ4 — ο ΔΕΣΜΕΥΜΕΝΟΣ πίνακας', () => {
  it('γράφει και τις τρεις πηγές `priced` (παρονομαστής της πύλης: δεν κρίνει κενό)', () => {
    const rows = energyPriceFreshness(ENERGY_REFERENCE_PRICES, ENERGY_REFERENCE_PRICES.generatedAt);
    expect(rows.every((row) => row.newest !== null)).toBe(true);
  });
});
