/**
 * ADR-422 L7 — tests για το config ετήσιας ενεργειακής ζήτησης (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: βαθμοημέρες ανά ζώνη (ψυχρότερη → περισσότερες), μονοτονία/όρια
 * των bands κατηγορίας, και τους getters (HDD lookup + ταξινόμηση ζήτησης).
 */

import type { ClimateZone } from '../../kenak-thermal-config';
import {
  ENERGY_DEMAND_CLASS_BANDS,
  HEATING_DEGREE_DAYS,
  classifyEnergyDemand,
  getHeatingDegreeDays,
} from '../annual-energy-config';

describe('annual-energy-config — βαθμοημέρες', () => {
  it('αυξάνονται από την ηπιότερη (A) στην ψυχρότερη (D) ζώνη', () => {
    expect(HEATING_DEGREE_DAYS.A).toBeLessThan(HEATING_DEGREE_DAYS.B);
    expect(HEATING_DEGREE_DAYS.B).toBeLessThan(HEATING_DEGREE_DAYS.C);
    expect(HEATING_DEGREE_DAYS.C).toBeLessThan(HEATING_DEGREE_DAYS.D);
  });

  it('getHeatingDegreeDays επιστρέφει την τιμή του πίνακα ανά ζώνη', () => {
    const zones: readonly ClimateZone[] = ['A', 'B', 'C', 'D'];
    for (const zone of zones) {
      expect(getHeatingDegreeDays(zone)).toBe(HEATING_DEGREE_DAYS[zone]);
    }
    expect(getHeatingDegreeDays('B')).toBe(1300);
  });
});

describe('annual-energy-config — bands κατηγορίας', () => {
  it('είναι αυστηρά αύξοντα με τελευταίο band Infinity', () => {
    for (let i = 1; i < ENERGY_DEMAND_CLASS_BANDS.length; i += 1) {
      expect(ENERGY_DEMAND_CLASS_BANDS[i].maxSpecificDemandKWhM2).toBeGreaterThan(
        ENERGY_DEMAND_CLASS_BANDS[i - 1].maxSpecificDemandKWhM2,
      );
    }
    const last = ENERGY_DEMAND_CLASS_BANDS[ENERGY_DEMAND_CLASS_BANDS.length - 1];
    expect(last.maxSpecificDemandKWhM2).toBe(Infinity);
    expect(last.label).toBe('H');
  });

  it('ξεκινά από την καλύτερη κατηγορία A+', () => {
    expect(ENERGY_DEMAND_CLASS_BANDS[0].label).toBe('A+');
  });
});

describe('annual-energy-config — classifyEnergyDemand', () => {
  it('ταξινομεί μηδενική/χαμηλή ζήτηση στην καλύτερη κατηγορία', () => {
    expect(classifyEnergyDemand(0)).toBe('A+');
    expect(classifyEnergyDemand(30)).toBe('A+'); // ακριβώς στο όριο (inclusive)
  });

  it('ταξινομεί ενδιάμεση ζήτηση στο σωστό band', () => {
    expect(classifyEnergyDemand(78)).toBe('B'); // 70 < 78 ≤ 95
    expect(classifyEnergyDemand(95)).toBe('B'); // όριο inclusive
    expect(classifyEnergyDemand(96)).toBe('C'); // πάνω από το όριο Β
  });

  it('ταξινομεί πολύ υψηλή ζήτηση στη χειρότερη κατηγορία H', () => {
    expect(classifyEnergyDemand(1000)).toBe('H');
  });

  it('είναι μονότονη ως προς την κατηγορία (όσο μεγαλύτερη ζήτηση τόσο χειρότερη)', () => {
    const labels = ENERGY_DEMAND_CLASS_BANDS.map((b) => b.label);
    const samples = [10, 40, 60, 80, 110, 140, 170, 210, 250, 400];
    const indices = samples.map((q) => labels.indexOf(classifyEnergyDemand(q)));
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
  });
});
