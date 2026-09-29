/**
 * ADR-890 §15 — η όψη του χάρτη σύγκρισης της σελίδας Δήμου: ίδια αναγωγή, ίδια κατάταξη με τον χάρτη της αναζήτησης,
 * τμήματα μόνο όπου λένε κάτι, ετικέτες μόνο όπου υπάρχει σημείο.
 */

import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import type { AdminOverviewFeature } from '@/lib/geo/admin-overview-file';
import type { PriceMapAreas } from '@/lib/market/price-map';
import { rankedSelectionsOf } from '@/lib/market/price-map-view';

import { childLabelsOf, childMapChoice, childPropertiesOf, childSegmentsOf, defaultChildSegment } from '../area-children-view';

const MUNICIPALITY: AdminArea = { id: 'municipality:0701', name: 'Δήμος Θεσσαλονίκης', level: 5, parentId: 'regional_unit:07' };
const unit = (code: string, name: string): AdminArea => ({ id: `municipal_unit:${code}`, name, level: 6, parentId: MUNICIPALITY.id });
const CHILDREN = [unit('070101', 'Δ.Ε. Θεσσαλονίκης'), unit('070102', 'Δ.Ε. Τριανδρίας'), unit('070103', 'Δ.Ε. Άλλη')];

const AREAS: PriceMapAreas = {
  'municipality:0701': { apartment: [1068, 1547], commercial: [206, 1082], land: [4] },
  'municipal_unit:070101': { apartment: [1052, 1544], commercial: [203, 1091] },
  'municipal_unit:070102': { apartment: [16, 1659] },
  'municipal_unit:070103': { apartment: [2] },
};

const properties = childPropertiesOf(MUNICIPALITY, CHILDREN);

describe('area-children-view', () => {
  it('οι Δ.Ε. έχουν γονέα τον Δήμο ⇒ κάτω από το κατώφλι παίρνουν ΤΙΜΗ ΔΗΜΟΥ (ίδια αναγωγή με την αναζήτηση)', () => {
    const rows = rankedSelectionsOf(properties, AREAS, childMapChoice('apartment'));
    expect(rows.map((row) => [row.id, row.resolution.kind])).toEqual([
      ['municipal_unit:070102', 'own'],
      ['municipal_unit:070103', 'parent'],
      ['municipal_unit:070101', 'own'],
    ]);
  });

  it('τμήματα: μόνο όσα έχουν τουλάχιστον μία Δ.Ε. με τιμή (δική της ή του Δήμου) — η γη με 4 συμβόλαια ΟΧΙ', () => {
    expect(childSegmentsOf(AREAS, properties)).toEqual(['apartment', 'commercial']);
  });

  it('κανένα τμήμα με τιμή ⇒ μόνο η αφετηρία, ώστε ο πίνακας να πει τίμια «λίγα» αντί να εξαφανιστεί', () => {
    const segments = childSegmentsOf({ 'municipal_unit:070101': { apartment: [1] } }, properties);
    expect(segments).toEqual(['apartment']);
    expect(defaultChildSegment(segments)).toBe('apartment');
    expect(defaultChildSegment(['commercial', 'storage'])).toBe('commercial');
  });

  it('ετικέτες: ένα σημείο ανά Δ.Ε. με `label`· χωρίς σημείο ή χωρίς γραμμή ⇒ καμία ετικέτα (ποτέ στο [0,0])', () => {
    const feature = (id: string, label?: readonly [number, number]): AdminOverviewFeature => ({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [] },
      properties: { id, name: id, parent: MUNICIPALITY.id, parentName: MUNICIPALITY.name, ...(label === undefined ? {} : { label }) },
    });
    const rows = rankedSelectionsOf(properties, AREAS, childMapChoice('apartment'));
    const labels = childLabelsOf(
      [feature('municipal_unit:070101', [22.96, 40.6]), feature('municipal_unit:070102'), feature('municipal_unit:999999', [1, 1])],
      rows,
      (row) => `${row.id}:${row.resolution.kind}`,
    );
    expect(labels.features).toEqual([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [22.96, 40.6] }, properties: { id: 'municipal_unit:070101', text: 'municipal_unit:070101:own' } },
    ]);
  });
});
