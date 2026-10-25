/**
 * ΑΓΚΥΡΕΣ — **Η ΔΗΛΩΜΕΝΗ ΑΠΟΔΟΣΗ ΠΕΡΙΟΧΗΣ** (ADR-890 §21): μετρημένο πρόθεμα + δηλωμένη ουρά, ποτέ ανάποδα.
 * Γεωμετρία: `admin-area-declaration-fixtures.ts`.
 */

import {
  declarableAdminAreas,
  declareAdminArea,
  deepestMeasuredId,
} from '@/lib/geo/admin-area-declaration';
import { adminAreaProvenanceOf, deepestAssignedLevel } from '@/lib/geo/admin-area-of-point';
import {
  CITY_CIRCLE,
  MEASURED_TO_MUNICIPALITY,
  TIGHT_CIRCLE,
  sources,
} from './admin-area-declaration-fixtures';

describe('declareAdminArea — δέχεται μόνο ό,τι συμπληρώνει τη μέτρηση', () => {
  it('οικισμός ⇒ η Δ.Ε. και η κοινότητά του, από τη γενεαλογία· η μέτρηση μένει αυτούσια', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'settlement:1303010101', CITY_CIRCLE, sources());
    expect(verdict).toEqual({
      kind: 'applied',
      assignment: {
        ...MEASURED_TO_MUNICIPALITY,
        municipalUnitId: 'municipal_unit:130301',
        communityId: 'community:13030101',
        nearBoundary: false,
        measuredDepth: 5,
      },
    });
  });

  it('η προέλευση ανά βαθμίδα: ως τον δήμο μετρημένη, από κάτω δηλωμένη', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'settlement:1303010101', CITY_CIRCLE, sources());
    if (verdict.kind !== 'applied') throw new Error('αναμενόταν εφαρμογή');
    expect([3, 4, 5, 6, 7, 8].map((level) => adminAreaProvenanceOf(verdict.assignment, level))).toEqual([
      'measured', 'measured', 'measured', 'declared', 'declared', null,
    ]);
  });

  it('άγνωστη ταυτότητα ⇒ unknown-area', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'municipal_unit:999999', CITY_CIRCLE, sources());
    expect(verdict).toEqual({ kind: 'rejected', reason: 'unknown-area' });
  });

  it('Δ.Ε. ΑΛΛΟΥ δήμου ⇒ contradicts-measured (η δήλωση ποτέ δεν υπερισχύει μέτρησης)', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'municipal_unit:130101', CITY_CIRCLE, sources());
    expect(verdict).toEqual({ kind: 'rejected', reason: 'contradicts-measured' });
  });

  it('η ίδια βαθμίδα με τη μέτρηση ⇒ not-deeper (συνεπής, αλλά δεν προσθέτει τίποτα)', async () => {
    const measuredToUnit = { ...MEASURED_TO_MUNICIPALITY, municipalUnitId: 'municipal_unit:130301', measuredDepth: 6 as const };
    const verdict = await declareAdminArea(measuredToUnit, 'municipal_unit:130301', CITY_CIRCLE, sources());
    expect(verdict).toEqual({ kind: 'rejected', reason: 'not-deeper' });
  });

  it('η βαθύτερη δηλωμένη περιοχή έξω από τον κύκλο αβεβαιότητας ⇒ outside-uncertainty', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'community:13030102', TIGHT_CIRCLE, sources());
    expect(verdict).toEqual({ kind: 'rejected', reason: 'outside-uncertainty' });
  });

  it('ίδια δήλωση, κύκλος πόλης ⇒ γίνεται δεκτή (ο κύκλος ΕΙΝΑΙ το κριτήριο)', async () => {
    const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, 'community:13030102', CITY_CIRCLE, sources());
    expect(verdict.kind).toBe('applied');
  });

  it('όριο που δεν διαβάστηκε ⇒ boundary-unavailable, ποτέ «δεκτή»', async () => {
    const verdict = await declareAdminArea(
      MEASURED_TO_MUNICIPALITY,
      'community:13030101',
      CITY_CIRCLE,
      sources({ regionOf: async () => null }),
    );
    expect(verdict).toEqual({ kind: 'rejected', reason: 'boundary-unavailable' });
  });
});

describe('declarableAdminAreas — οι επιλογές = ό,τι θα δεχόταν ο ΙΔΙΟΣ κριτής', () => {
  it('κύκλος πόλης ⇒ κάθε απόγονος του μετρημένου δήμου', async () => {
    const options = await declarableAdminAreas(MEASURED_TO_MUNICIPALITY, CITY_CIRCLE, sources());
    expect(options.map(({ id }) => id).sort()).toEqual([
      'community:13030101',
      'community:13030102',
      'community:13030201',
      'municipal_unit:130301',
      'municipal_unit:130302',
      'settlement:1303010101',
      'settlement:1303020101',
    ]);
  });

  it('στενός κύκλος ⇒ μόνο όσα τον τέμνουν· κάθε επιλογή περνά από τον declareAdminArea', async () => {
    const options = await declarableAdminAreas(MEASURED_TO_MUNICIPALITY, TIGHT_CIRCLE, sources());
    expect(options.map(({ id }) => id).sort()).toEqual([
      'community:13030101',
      'municipal_unit:130301',
      'settlement:1303010101',
    ]);
    for (const option of options) {
      const verdict = await declareAdminArea(MEASURED_TO_MUNICIPALITY, option.id, TIGHT_CIRCLE, sources());
      expect(verdict.kind).toBe('applied');
    }
  });

  it('ρίζα των επιλογών = η βαθύτερη μετρημένη ταυτότητα', () => {
    expect(deepestMeasuredId(MEASURED_TO_MUNICIPALITY)).toBe('municipality:1303');
  });
});

describe('deepestAssignedLevel — ο κρίκος 28 πάνω σε ωμό έγγραφο', () => {
  it('η βαθύτερη ταυτότητα· μη-συμβολοσειρές αγνοούνται', () => {
    expect(deepestAssignedLevel({ regionId: 'region:112', municipalityId: 'municipality:1303', municipalUnitId: null })).toBe(5);
    expect(deepestAssignedLevel({ communityId: 'community:13030101' })).toBe(7);
    expect(deepestAssignedLevel({ municipalUnitId: 42 })).toBeNull();
  });
});
