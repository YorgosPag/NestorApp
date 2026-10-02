/**
 * ADR-890 §14 — η καθαρή όψη του χάρτη τιμών: αφετηρία από την αναζήτηση, επιτρεπτοί συνδυασμοί, κατάσταση
 * ανά περιοχή (`feature-state`), ο πίνακας «Περιοχές στην οθόνη» (η εναλλακτική του κλικ για πληκτρολόγιο).
 */

import type { AdminOverviewFeature, AdminOverviewProperties } from '@/lib/geo/admin-overview-file';
import type { PriceMapAreas } from '@/lib/market/price-map';
import {
  VISIBLE_ROWS_LIMIT,
  defaultPriceMapChoice,
  featureStatesOf,
  normalizeChoice,
  priceMapLabelPointsOf,
  segmentsFor,
  sourcesFor,
  visibleRowsOf,
  type PriceMapChoice,
  type PriceMapSelection,
} from '@/lib/market/price-map-view';

const CHOICE: PriceMapChoice = { offer: 'sale', source: 'contracts', segment: 'apartment' };

function area(id: string, name: string, parent: string | null = null): AdminOverviewProperties {
  return { id, name, parent, parentName: parent === null ? null : 'Δήμος Χ' };
}

describe('price-map-view — επιλογή', () => {
  it('χωρίς φίλτρα ⇒ πώληση · διαμέρισμα · συμβόλαια (η πλουσιότερη πηγή)', () => {
    expect(defaultPriceMapChoice({})).toEqual(CHOICE);
  });

  it('μόνο ενοικίαση ⇒ ενοίκιο με ζητούμενες (το μητρώο μεταβιβάσεων δεν έχει μισθώσεις)', () => {
    expect(defaultPriceMapChoice({ offerKind: ['leaseOut'] })).toEqual({ offer: 'rent', source: 'asking', segment: 'apartment' });
  });

  it('ένας τύπος ακινήτου ⇒ το τμήμα του· πολλοί ⇒ διαμέρισμα', () => {
    expect(defaultPriceMapChoice({ type: ['plot'] }).segment).toBe('land');
    expect(defaultPriceMapChoice({ type: ['plot', 'apartment', 'detached_house'] }).segment).toBe('apartment');
  });

  it('συνδυασμός που δεν υπάρχει διορθώνεται: ενοίκιο + συμβόλαια ⇒ ζητούμενες · ενοίκιο γης ⇒ πρώτο τμήμα', () => {
    expect(normalizeChoice({ offer: 'rent', source: 'contracts', segment: 'land' })).toEqual({
      offer: 'rent', source: 'asking', segment: segmentsFor('rent')[0],
    });
    expect(sourcesFor('rent')).toEqual(['asking']);
  });
});

describe('price-map-view — κατάσταση ανά περιοχή', () => {
  const AREAS: PriceMapAreas = {
    'municipality:1': { apartment: [30, 1500] },
    'municipal_unit:11': { apartment: [2] },
    'municipal_unit:12': { apartment: [8, 2500] },
  };
  const FEATURES = [area('municipal_unit:11', 'Α', 'municipality:1'), area('municipal_unit:12', 'Β', 'municipality:1'), area('municipal_unit:99', 'Γ')];

  it('ΚΑΘΕ περιοχή παίρνει κατάσταση — καμία δεν κρατά μπαγιάτικη από προηγούμενη επιλογή', () => {
    expect(featureStatesOf(FEATURES.map((properties) => ({ properties })), AREAS, CHOICE)).toEqual([
      ['municipal_unit:11', { c: 3, k: 1 }],
      ['municipal_unit:12', { c: 4, k: 0 }],
      ['municipal_unit:99', { c: -1, k: 2 }],
    ]);
  });

  it('πίνακας: ακριβότερη πρώτα, «λίγα» στο τέλος, μία γραμμή ανά περιοχή, έως το όριο', () => {
    const rows = visibleRowsOf([...FEATURES, FEATURES[0]], AREAS, CHOICE);
    expect(rows.map((row) => row.id)).toEqual(['municipal_unit:12', 'municipal_unit:11', 'municipal_unit:99']);
    const many = Array.from({ length: 30 }, (_, index) => area(`municipal_unit:${index}`, `Π${index}`));
    expect(visibleRowsOf(many, AREAS, CHOICE)).toHaveLength(VISIBLE_ROWS_LIMIT);
  });
});

describe('ADR-890 §18 — `priceMapLabelPointsOf`: ΕΝΑΣ μηχανισμός ετικετών για κάθε χάρτη τιμών', () => {
  const feature = (id: string): AdminOverviewFeature => ({
    type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: [] },
    properties: { id, name: id, parent: null, parentName: null, label: [22.9, 40.6] },
  });
  const row = (id: string, resolution: PriceMapSelection['resolution']): PriceMapSelection => ({ id, name: id, parentName: null, resolution });
  const ROWS = [
    row('big', { kind: 'own', n: 900, median: 1500, classIndex: 3 }),
    row('small', { kind: 'own', n: 6, median: 2400, classIndex: 4 }),
    row('few', { kind: 'few', n: 2 }),
  ];
  const FEATURES = ROWS.map((item) => feature(item.id));
  const ranks = (points: GeoJSON.FeatureCollection<GeoJSON.Point>) =>
    Object.fromEntries(points.features.map((point) => [point.properties?.id, point.properties?.rank]));

  it('η ΕΠΙΛΕΓΜΕΝΗ περιοχή παίρνει rank −1: ο αριθμός που ζήτησε ο άνθρωπος δεν κρύβεται ποτέ από σύγκρουση', () => {
    expect(ranks(priceMapLabelPointsOf(FEATURES, ROWS, () => 'x'))).toEqual({ big: 0, small: 1, few: 2 });
    expect(ranks(priceMapLabelPointsOf(FEATURES, ROWS, () => 'x', 'few'))).toEqual({ big: 0, small: 1, few: -1 });
  });

  it('κείμενο `null` ⇒ ΚΑΜΙΑ ετικέτα (ο χάρτης της αναζήτησης δεν γράφει «λίγα»)· οι υπόλοιπες κρατούν την προτεραιότητά τους', () => {
    const points = priceMapLabelPointsOf(FEATURES, ROWS, (item) => (item.resolution.kind === 'few' ? null : item.id));
    expect(points.features.map((point) => point.properties?.text)).toEqual(['big', 'small']);
    expect(ranks(points)).toEqual({ big: 0, small: 1 });
  });
});
