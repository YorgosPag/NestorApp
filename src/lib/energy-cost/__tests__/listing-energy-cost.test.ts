/**
 * ADR-777 §8.95 — **η εκτίμηση ετήσιου κόστους ενέργειας**: έξι καταστάσεις (§8.96: ΠΕΑ κτηρίου), εύρος από μετρημένες τιμές, και ποτέ
 * ποσό όπου λείπει οτιδήποτε.
 */

import { CERTIFICATE_ENERGY_SOURCES } from '@/constants/certificate-energy-sources';
import type { FinalEnergyLine } from '@/lib/energy-certificate/certificate-final-energy';

import {
  ENERGY_REFERENCE_PRICES,
  ENERGY_SOURCE_PRICING,
  type EnergyReferencePrices,
} from '../energy-reference-prices';
import { listingEnergyCost, type EnergyCostSubject } from '../listing-energy-cost';

const PRICES: EnergyReferencePrices = {
  generatedAt: '2026-10-13',
  sources: {
    electricity: { periods: [{ period: '2025-S2', eurPerKwh: 0.2 }, { period: '2026-S1', eurPerKwh: 0.25 }] },
    oil: { periods: [{ period: '2025-S2', eurPerKwh: 0.12 }, { period: '2026-S1', eurPerKwh: 0.1 }] },
  },
};
const TODAY = '2026-10-13';

function subject(finalEnergy: readonly FinalEnergyLine[] | null, usefulArea: number | null = 100): EnergyCostSubject {
  return {
    energyClass: 'C',
    energyCertificate: { primaryEnergy: null, co2Emissions: null, usefulArea, finalEnergy, scope: null, absence: null },
    commonCharges: null,
  };
}

const ELECTRIC_AND_OIL: readonly FinalEnergyLine[] = [
  { source: 'electricity', perSqm: 20 },
  { source: 'oil', perSqm: 80 },
];

describe('Κ1 — πότε ΔΕΝ υπάρχει ποσό, και γιατί', () => {
  it('🔴 κουτί `null` ή χωρίς κλάση ⇒ hidden — η ερώτηση δεν τίθεται', () => {
    expect(listingEnergyCost({ ...subject(ELECTRIC_AND_OIL), energyCertificate: null }, PRICES, TODAY)).toEqual({ kind: 'hidden' });
    expect(listingEnergyCost({ ...subject(ELECTRIC_AND_OIL), energyClass: null }, PRICES, TODAY)).toEqual({ kind: 'hidden' });
  });

  it('🔴 λείπει ο πίνακας ή η ωφέλιμη επιφάνεια ⇒ undeclared — ποτέ «0 €»', () => {
    expect(listingEnergyCost(subject(null), PRICES, TODAY)).toEqual({ kind: 'undeclared' });
    expect(listingEnergyCost(subject(ELECTRIC_AND_OIL, null), PRICES, TODAY)).toEqual({ kind: 'undeclared' });
  });

  it('🔴 πηγή χωρίς επίσημη τιμή ⇒ unpriced με ΤΟ ΟΝΟΜΑ της — όχι ποσό που την παραλείπει', () => {
    const cost = listingEnergyCost(subject([...ELECTRIC_AND_OIL, { source: 'biomass', perSqm: 40 }]), PRICES, TODAY);
    expect(cost).toEqual({ kind: 'unpriced', sources: ['biomass'] });
  });

  it('🔴 πηγή με τιμή που ΛΕΙΠΕΙ από τον πίνακα ⇒ stale-prices (φυσικό αέριο χωρίς σειρά)', () => {
    expect(listingEnergyCost(subject([{ source: 'natural-gas', perSqm: 50 }]), PRICES, TODAY)).toEqual({ kind: 'stale-prices' });
  });

  it('μόνο ενέργεια περιβάλλοντος, καμία αγοραζόμενη πηγή ⇒ undeclared — μισοαντιγραμμένος πίνακας, όχι «δωρεάν»', () => {
    expect(listingEnergyCost(subject([{ source: 'solar', perSqm: 15 }]), PRICES, TODAY)).toEqual({ kind: 'undeclared' });
  });

  it('🔴 ΠΕΑ ολόκληρου κτηρίου (ADR-777 §8.96) ⇒ building-certificate: τα kWh/m² είναι του κτηρίου, όχι της μονάδας', () => {
    const building = subject(ELECTRIC_AND_OIL);
    const certificate = { ...building.energyCertificate!, scope: 'building' as const };
    expect(listingEnergyCost({ ...building, energyCertificate: certificate }, PRICES, TODAY)).toEqual({ kind: 'building-certificate' });
  });

  it('`scope: unit` ή αδήλωτο (`null`, παλιά αγγελία) ⇒ η εκτίμηση βγαίνει όπως πριν', () => {
    const unit = subject(ELECTRIC_AND_OIL);
    expect(listingEnergyCost({ ...unit, energyCertificate: { ...unit.energyCertificate!, scope: 'unit' } }, PRICES, TODAY).kind).toBe('estimated');
    expect(listingEnergyCost(unit, PRICES, TODAY).kind).toBe('estimated');
  });
});

describe('Κ2 — το εύρος', () => {
  it('🔴 κάτω άκρο = κάθε πηγή στη χαμηλότερη τιμή της· πάνω = στην υψηλότερη· στη δεκάδα', () => {
    const cost = listingEnergyCost(subject(ELECTRIC_AND_OIL), PRICES, TODAY);
    // ρεύμα 2.000 kWh × (0,20 … 0,25) = 400 … 500 · πετρέλαιο 8.000 kWh × (0,10 … 0,12) = 800 … 960
    expect(cost).toMatchObject({ kind: 'estimated', low: 1200, high: 1460, pricesFrom: '2025-S2', pricesTo: '2026-S1' });
  });

  it('οι γραμμές είναι kWh ΤΟΝ ΧΡΟΝΟ για το ακίνητο (ανά m² × ωφέλιμη), και η ηλιακή μετρά 0 €', () => {
    const cost = listingEnergyCost(subject([...ELECTRIC_AND_OIL, { source: 'solar', perSqm: 10 }], 80), PRICES, TODAY);
    if (cost.kind !== 'estimated') throw new Error(cost.kind);
    expect(cost.lines).toEqual([
      { source: 'electricity', kwhPerYear: 1600 },
      { source: 'oil', kwhPerYear: 6400 },
      { source: 'solar', kwhPerYear: 800 },
    ]);
    expect(cost.low).toBe(960); // 1.600×0,20 + 6.400×0,10
    expect(cost.high).toBe(1170); // 1.600×0,25 + 6.400×0,12 = 1.168
  });

  it('τα κοινόχρηστα που δηλώνουν θέρμανση ΣΗΜΑΙΝΟΝΤΑΙ — και δεν αφαιρείται τίποτα', () => {
    const plain = listingEnergyCost(subject(ELECTRIC_AND_OIL), PRICES, TODAY);
    const withHeating = listingEnergyCost(
      { ...subject(ELECTRIC_AND_OIL), commonCharges: { monthlyAmount: 90, includes: ['heating', 'elevator'] } },
      PRICES,
      TODAY,
    );
    expect(plain).toMatchObject({ heatingInCommonCharges: false });
    expect(withHeating).toMatchObject({ heatingInCommonCharges: true, low: 1200, high: 1460 });
  });
});

describe('Κ3 — παλαίωση των τιμών', () => {
  it('🔴 18 μήνες μετά το τέλος του νεότερου εξαμήνου ο πίνακας ΣΩΠΑΙΝΕΙ — δεν δείχνει παλιό ποσό', () => {
    // νεότερο εξάμηνο 2026-S1 ⇒ τελειώνει 30/06/2026 ⇒ ισχύει ως και 31/12/2027
    expect(listingEnergyCost(subject(ELECTRIC_AND_OIL), PRICES, '2027-12-31').kind).toBe('estimated');
    expect(listingEnergyCost(subject(ELECTRIC_AND_OIL), PRICES, '2028-01-01')).toEqual({ kind: 'stale-prices' });
  });

  it('εξάμηνο S2 ⇒ τελειώνει 31/12 ⇒ ισχύει ως και 30/06 του μεθεπόμενου έτους', () => {
    const prices: EnergyReferencePrices = { generatedAt: '2026-01-10', sources: { electricity: { periods: [{ period: '2025-S2', eurPerKwh: 0.2 }] } } };
    const electric = subject([{ source: 'electricity', perSqm: 30 }]);
    expect(listingEnergyCost(electric, prices, '2027-06-30').kind).toBe('estimated');
    expect(listingEnergyCost(electric, prices, '2027-07-01').kind).toBe('stale-prices');
  });
});

describe('Κ4 — ο πίνακας που έγραψε ο γεννήτορας', () => {
  const priced = CERTIFICATE_ENERGY_SOURCES.filter((source) => ENERGY_SOURCE_PRICING[source] === 'priced');

  it('🔴 κάθε πηγή `priced` ΕΧΕΙ σειρά τιμών — αλλιώς η δήλωση «έχει τιμή» είναι ψέμα', () => {
    for (const source of priced) {
      expect(ENERGY_REFERENCE_PRICES.sources[source]?.periods.length).toBeGreaterThan(0);
    }
  });

  it('κάθε τιμή είναι €/kWh σε λογικό εύρος, με εξάμηνο σε μορφή Eurostat, παλαιότερο πρώτο', () => {
    for (const source of priced) {
      const periods = ENERGY_REFERENCE_PRICES.sources[source]?.periods ?? [];
      expect(periods.map((entry) => entry.period)).toEqual([...periods.map((entry) => entry.period)].sort());
      for (const { period, eurPerKwh } of periods) {
        expect(period).toMatch(/^\d{4}-S[12]$/);
        expect(eurPerKwh).toBeGreaterThan(0.02);
        expect(eurPerKwh).toBeLessThan(1);
      }
    }
  });

  it('πηγή `free` ή `unpriced` ΔΕΝ έχει γραμμή στον πίνακα', () => {
    const others = CERTIFICATE_ENERGY_SOURCES.filter((source) => ENERGY_SOURCE_PRICING[source] !== 'priced');
    for (const source of others) expect(ENERGY_REFERENCE_PRICES.sources[source]).toBeUndefined();
  });
});
