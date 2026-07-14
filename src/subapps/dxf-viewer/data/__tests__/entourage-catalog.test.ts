/**
 * ADR-654 M6/M7 — Entourage catalog core + people/vehicles packs: ο SSoT της ΚΛΙΜΑΚΑΣ.
 *
 * Ίδιο invariant με τα έπιπλα («μεγάλη πλευρά», ΟΧΙ «πλάτος»), τώρα μέσα από τη ΚΟΙΝΗ μηχανή
 * `createEntourageCatalog` — ένας πυρήνας, πολλές οικογένειες. M7: `facets` (0..N) αντί ενικού
 * `secondary`.
 */

import {
  createEntourageCatalog,
  entourageLabelParts,
  type EntourageDef,
} from '../entourage-catalog-core';
import { composeEntourageDisplayName } from '../entourage-display-name';
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
import {
  listPlantsPlanDefs,
  getPlantsPlanSizeMm,
  PLANTS_PLAN_LONG_SIDE_MM,
} from '../plants-plan-catalog';

describe('entourage-catalog-core — «μεγάλη πλευρά», ΟΧΙ «πλάτος»', () => {
  const data: EntourageDef[] = [
    { id: 'x-landscape', category: 'a', facets: {}, series: 1, aspect: 2 }, // πλατύ
    { id: 'x-portrait', category: 'a', facets: {}, series: 2, aspect: 0.5 }, // ψηλό
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
      data: [{ id: 'y', category: 'z', facets: {}, series: 1, aspect: 1 }],
      longSideMm: { a: 1000 },
      i18nPrefix: 'demo',
    });
    expect(bad.getSizeMm('y')).toBeNull(); // 'z' δεν έχει μήκος
  });

  it('facets={} ⇒ facetKeys κενό· facet set ⇒ i18n key ανά facet', () => {
    expect(cat.getLabelParts(data[0]).facetKeys).toEqual({});
    const withFacet = createEntourageCatalog<'a'>({
      data: [{ id: 'w', category: 'a', facets: { color: 'red' }, series: 1, aspect: 1 }],
      longSideMm: { a: 1000 },
      i18nPrefix: 'veh',
    });
    expect(withFacet.getLabelParts(withFacet.getById('w')!).facetKeys).toEqual({
      color: 'veh.color.red',
    });
  });

  it('N facets ⇒ ένα i18n key ανά facet (namespace = facet name)', () => {
    const parts = entourageLabelParts(
      { id: 'z', category: 'sofa', facets: { kind: 'composition', style: 'modern' }, series: 3, aspect: 1 },
      'furniturePlan',
    );
    expect(parts.categoryKey).toBe('furniturePlan.categories.sofa');
    expect(parts.facetKeys).toEqual({
      kind: 'furniturePlan.kind.composition',
      style: 'furniturePlan.style.modern',
    });
  });
});

describe('composeEntourageDisplayName — σύνθεση με σειρά facets', () => {
  const echo = (key: string) => key; // ταυτοτική «μετάφραση» → ελέγχει τη δομή, όχι τα strings
  const def: EntourageDef = {
    id: 'd', category: 'sofa', facets: { kind: 'composition', style: 'modern' }, series: 5, aspect: 1,
  };

  it('κατηγορία μόνο (κενή σειρά facets) → «cat NN»', () => {
    const name = composeEntourageDisplayName(echo, entourageLabelParts(def, 'f'), []);
    expect(name).toBe('f.categories.sofa 5');
  });

  it('τηρεί τη σειρά του descriptor (kind πρώτο, μετά style)', () => {
    const name = composeEntourageDisplayName(echo, entourageLabelParts(def, 'f'), ['kind', 'style']);
    expect(name).toBe('f.categories.sofa · f.kind.composition · f.style.modern 5');
  });

  it('facet που λείπει από το sprite παραλείπεται σιωπηλά', () => {
    const name = composeEntourageDisplayName(echo, entourageLabelParts(def, 'f'), ['style', 'color']);
    expect(name).toBe('f.categories.sofa · f.style.modern 5');
  });
});

describe.each([
  ['people', listPeoplePlanDefs, getPeoplePlanSizeMm, PEOPLE_PLAN_LONG_SIDE_MM, 124],
  ['vehicles', listVehiclePlanDefs, getVehiclePlanSizeMm, VEHICLE_PLAN_LONG_SIDE_MM, 93],
  ['plants', listPlantsPlanDefs, getPlantsPlanSizeMm, PLANTS_PLAN_LONG_SIDE_MM, 103],
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

  it('series μοναδικό μέσα σε κάθε συνδυασμό facets', () => {
    const seen = new Set<string>();
    for (const def of list()) {
      const key = `${def.category}/${JSON.stringify(def.facets)}/${def.series}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('facets ανά οικογένεια', () => {
  it('άνθρωποι: κάθε def έχει facets κενό', () => {
    for (const def of listPeoplePlanDefs()) expect(def.facets).toEqual({});
  });

  it('άνθρωποι: label parts → σωστά i18n κλειδιά, χωρίς facets', () => {
    const def = listPeoplePlanDefs()[0];
    const parts = getPeoplePlanLabelParts(def);
    expect(parts.categoryKey).toBe(`peoplePlan.categories.${def.category}`);
    expect(parts.facetKeys).toEqual({});
  });

  it('οχήματα: κάθε def έχει χρώμα (facet color) + label parts με color key', () => {
    for (const def of listVehiclePlanDefs()) expect(typeof def.facets.color).toBe('string');
    const def = listVehiclePlanDefs()[0];
    const parts = getVehiclePlanLabelParts(def);
    expect(parts.categoryKey).toBe(`vehiclePlan.categories.${def.category}`);
    expect(parts.facetKeys).toEqual({ color: `vehiclePlan.color.${def.facets.color}` });
  });

  it('getPeoplePlanDef επιστρέφει def με facets κενό', () => {
    const first = listPeoplePlanDefs()[0];
    expect(getPeoplePlanDef(first.id)?.facets).toEqual({});
  });

  it('φυτά: κάθε def έχει facets κενό (μόνο category)', () => {
    for (const def of listPlantsPlanDefs()) expect(def.facets).toEqual({});
  });
});
