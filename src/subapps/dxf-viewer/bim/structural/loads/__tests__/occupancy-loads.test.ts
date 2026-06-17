/**
 * ADR-474 — Occupancy-driven auto structural area loads.
 *
 * Επιβεβαιώνει:
 *   · q_k ανά κατηγορία (EN1991-1-1 Table 6.2) + default κατοικία.
 *   · g_k auto από πάχος πλάκας (ίδιο βάρος + επιστρώσεις + χωρίσματα).
 *   · resolveEffectiveAreaLoads — explicit kPa κερδίζει· αλλιώς auto· occupancy οδηγεί q_k.
 */

import {
  DEFAULT_OCCUPANCY,
  DEFAULT_SLAB_THICKNESS_MM,
  OCCUPANCY_IMPOSED_KPA,
  isOccupancyCategory,
  resolveDefaultDeadLoadKpa,
  resolveEffectiveAreaLoads,
  resolveImposedLoadKpa,
  resolveOccupancyFromBuildingCategory,
} from '../occupancy-loads';

describe('ADR-474 — imposed load q_k (EN1991-1-1)', () => {
  it('default κατηγορία = κατοικία (2.0 kPa)', () => {
    expect(DEFAULT_OCCUPANCY).toBe('residential');
    expect(resolveImposedLoadKpa()).toBe(2.0);
    expect(resolveImposedLoadKpa(undefined)).toBe(2.0);
  });
  it('q_k ανά κατηγορία', () => {
    expect(resolveImposedLoadKpa('office')).toBe(3.0);
    expect(resolveImposedLoadKpa('congregation')).toBe(5.0);
    expect(resolveImposedLoadKpa('storage')).toBe(7.5);
    expect(OCCUPANCY_IMPOSED_KPA.shopping).toBe(5.0);
  });
  it('type guard', () => {
    expect(isOccupancyCategory('office')).toBe(true);
    expect(isOccupancyCategory('bogus')).toBe(false);
    expect(isOccupancyCategory(undefined)).toBe(false);
  });
});

describe('ADR-474 — dead load g_k (auto από γεωμετρία πλάκας)', () => {
  it('200mm πλάκα ⇒ 5.0 (ίδιο βάρος) + 1.5 (επιστρ.) + 1.0 (χωρίσμ.) = 7.5 kPa', () => {
    expect(resolveDefaultDeadLoadKpa(200)).toBeCloseTo(7.5, 6);
  });
  it('absent πάχος ⇒ default 200mm', () => {
    expect(resolveDefaultDeadLoadKpa()).toBeCloseTo(resolveDefaultDeadLoadKpa(DEFAULT_SLAB_THICKNESS_MM), 6);
  });
  it('παχύτερη πλάκα ⇒ μεγαλύτερο g_k (μονοτονία)', () => {
    expect(resolveDefaultDeadLoadKpa(300)).toBeGreaterThan(resolveDefaultDeadLoadKpa(200));
  });
});

describe('ADR-474 — resolveEffectiveAreaLoads (explicit-wins, αλλιώς auto)', () => {
  it('χωρίς explicit ⇒ auto: residential q_k=2.0, g_k=7.5 (200mm)', () => {
    expect(resolveEffectiveAreaLoads({})).toEqual({ deadAreaLoadKpa: 7.5, liveAreaLoadKpa: 2.0 });
  });
  it('occupancy οδηγεί το ωφέλιμο όταν λείπει explicit live', () => {
    expect(resolveEffectiveAreaLoads({ occupancy: 'storage' }).liveAreaLoadKpa).toBe(7.5);
  });
  it('explicit kPa υπερισχύει του auto (Revit override)', () => {
    const out = resolveEffectiveAreaLoads({ explicitDeadKpa: 9, explicitLiveKpa: 4, occupancy: 'office' });
    expect(out).toEqual({ deadAreaLoadKpa: 9, liveAreaLoadKpa: 4 });
  });
  it('μη-έγκυρα explicit (≤0) ⇒ πέφτει σε auto', () => {
    const out = resolveEffectiveAreaLoads({ explicitDeadKpa: 0, explicitLiveKpa: -1, occupancy: 'office' });
    expect(out).toEqual({ deadAreaLoadKpa: 7.5, liveAreaLoadKpa: 3.0 });
  });
});

describe('ADR-474 — occupancy κληρονομικότητα από building.category (SSoT)', () => {
  it('αντιστοίχιση ανά κατηγορία κτιρίου', () => {
    expect(resolveOccupancyFromBuildingCategory('residential')).toBe('residential');
    expect(resolveOccupancyFromBuildingCategory('commercial')).toBe('shopping');
    expect(resolveOccupancyFromBuildingCategory('mixed')).toBe('office');
    expect(resolveOccupancyFromBuildingCategory('industrial')).toBe('storage');
  });
  it('άγνωστη/absent κατηγορία → undefined (πέφτει σε override/default)', () => {
    expect(resolveOccupancyFromBuildingCategory('bogus')).toBeUndefined();
    expect(resolveOccupancyFromBuildingCategory(undefined)).toBeUndefined();
  });
  it('end-to-end: commercial κτίριο χωρίς override → q_k=5.0 (shopping)', () => {
    const occ = resolveOccupancyFromBuildingCategory('commercial');
    expect(resolveEffectiveAreaLoads({ occupancy: occ }).liveAreaLoadKpa).toBe(5.0);
  });
});
