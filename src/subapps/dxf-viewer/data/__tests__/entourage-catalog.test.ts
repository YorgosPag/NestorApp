/**
 * ADR-654 M6 — Entourage catalog core + people/vehicles packs: ο SSoT της ΚΛΙΜΑΚΑΣ.
 *
 * Ίδιο invariant με τα έπιπλα («μεγάλη πλευρά», ΟΧΙ «πλάτος»), τώρα μέσα από τη ΚΟΙΝΗ μηχανή
 * `createEntourageCatalog` — ένας πυρήνας, πολλές οικογένειες.
 */

import { createEntourageCatalog, type EntourageDef } from '../entourage-catalog-core';
import {
  listPeoplePlanDefs,
  getPeoplePlanDef,
  getPeoplePlanLabelParts,
  getPeoplePlanSizeMm,
  PEOPLE_PLAN_LONG_SIDE_MM,
} from '../people-plan-catalog';
import {
  listVehiclePlanDefs,
  getVehiclePlanSizeMm,
  getVehiclePlanLabelParts,
  VEHICLE_PLAN_LONG_SIDE_MM,
} from '../vehicles-plan-catalog';

describe('entourage-catalog-core — «μεγάλη πλευρά», ΟΧΙ «πλάτος»', () => {
  const data: EntourageDef[] = [
    { id: 'x-landscape', category: 'a', secondary: null, series: 1, aspect: 2 }, // πλατύ
    { id: 'x-portrait', category: 'a', secondary: null, series: 2, aspect: 0.5 }, // ψηλό
  ];
  const cat = createEntourageCatalog<'a'>({ data, longSideMm: { a: 1000 }, i18nPrefix: 'demo' });

  it('LANDSCAPE (aspect>1): το μήκος πάει στο ΠΛΑΤΟΣ', () => {
    const s = cat.getSizeMm('x-landscape')!;
    expect(s.widthMm).toBeCloseTo(1000, 6);
    expect(s.heightMm).toBeCloseTo(500, 6);
  });

  it('PORTRAIT (aspect<1): το μήκος πάει στο ΥΨΟΣ', () => {
    const s = cat.getSizeMm('x-portrait')!;
    expect(s.heightMm).toBeCloseTo(1000, 6);
    expect(s.widthMm).toBeCloseTo(500, 6);
  });

  it('άγνωστο id ή κατηγορία χωρίς μήκος → null', () => {
    expect(cat.getSizeMm('nope')).toBeNull();
    const bad = createEntourageCatalog<'a'>({
      data: [{ id: 'y', category: 'z', secondary: null, series: 1, aspect: 1 }],
      longSideMm: { a: 1000 },
      i18nPrefix: 'demo',
    });
    expect(bad.getSizeMm('y')).toBeNull(); // 'z' δεν έχει μήκος
  });

  it('secondary=null ⇒ secondaryKey null· secondary set ⇒ i18n key', () => {
    expect(cat.getLabelParts(data[0]).secondaryKey).toBeNull();
    const withSec = createEntourageCatalog<'a'>({
      data: [{ id: 'w', category: 'a', secondary: 'red', series: 1, aspect: 1 }],
      longSideMm: { a: 1000 },
      i18nPrefix: 'veh',
    });
    expect(withSec.getLabelParts(withSec.getById('w')!).secondaryKey).toBe('veh.secondary.red');
  });
});

describe.each([
  ['people', listPeoplePlanDefs, getPeoplePlanSizeMm, PEOPLE_PLAN_LONG_SIDE_MM, 124],
  ['vehicles', listVehiclePlanDefs, getVehiclePlanSizeMm, VEHICLE_PLAN_LONG_SIDE_MM, 87],
] as const)('%s pack — ακεραιότητα + κλίμακα', (_name, list, getSize, longSideMm, expectedCount) => {
  it(`έχει ${expectedCount} sprites με μοναδικά ids`, () => {
    const ids = list().map((d) => d.id);
    expect(ids.length).toBe(expectedCount);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('κάθε def έχει θετικό aspect και κατηγορία με ορισμένο μήκος', () => {
    for (const def of list()) {
      expect(def.aspect).toBeGreaterThan(0);
      expect((longSideMm as Record<string, number>)[def.category]).toBeGreaterThan(0);
    }
  });

  it('η μεγάλη πλευρά ισούται ΠΑΝΤΑ με το μήκος της κατηγορίας + διατηρεί αναλογίες', () => {
    for (const def of list()) {
      const size = getSize(def.id)!;
      expect(size).not.toBeNull();
      expect(Math.max(size.widthMm, size.heightMm)).toBeCloseTo(
        (longSideMm as Record<string, number>)[def.category],
        6,
      );
      expect(size.widthMm / size.heightMm).toBeCloseTo(def.aspect, 3);
    }
  });

  it('series μοναδικό μέσα σε κάθε ζεύγος facets', () => {
    const seen = new Set<string>();
    for (const def of list()) {
      const key = `${def.category}/${def.secondary ?? ''}/${def.series}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('facets ανά οικογένεια', () => {
  it('άνθρωποι: κάθε def έχει secondary === null', () => {
    for (const def of listPeoplePlanDefs()) expect(def.secondary).toBeNull();
  });

  it('άνθρωποι: label parts → σωστά i18n κλειδιά, χωρίς secondary', () => {
    const def = listPeoplePlanDefs()[0];
    const parts = getPeoplePlanLabelParts(def);
    expect(parts.categoryKey).toBe(`peoplePlan.categories.${def.category}`);
    expect(parts.secondaryKey).toBeNull();
  });

  it('οχήματα: κάθε def έχει χρώμα (secondary) + label parts με secondary key', () => {
    for (const def of listVehiclePlanDefs()) expect(typeof def.secondary).toBe('string');
    const def = listVehiclePlanDefs()[0];
    const parts = getVehiclePlanLabelParts(def);
    expect(parts.categoryKey).toBe(`vehiclePlan.categories.${def.category}`);
    expect(parts.secondaryKey).toBe(`vehiclePlan.secondary.${def.secondary}`);
  });
});
