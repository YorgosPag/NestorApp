/**
 * ADR-717 — `findDxfEntitiesInScope`: bulk resolution οντοτήτων raw-DXF μέσα στην ενεργή
 * εμβέλεια ορόφων.
 *
 * Γιατί έχει δικά του anchors: το selection-highlight pass το καλεί σε ΚΑΘΕ αλλαγή επιλογής με
 * ΟΛΑ τα επιλεγμένα ids, και το per-id `findDxfEntityInScope` είναι πλέον wrapper πάνω του —
 * άρα μια αστοχία εδώ σπάει ΤΑΥΤΟΧΡΟΝΑ hover glow, grips, ghost seating και highlight. Τα tests
 * κλειδώνουν τα τρία μη-προφανή συμβόλαια: **σειρά καλούντος**, **πρώτος όροφος νικά**, και
 * **οι αστοχίες παραλείπονται αντί να μηδενίζουν το αποτέλεσμα**.
 */

import type { DxfEntityUnion, DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';

const mockStack = jest.fn<Array<{ scene: DxfScene; floorElevationMm: number; levelId: string | null }>, []>(() => []);

jest.mock('../multi-floor-dxf-source', () => ({ getMultiFloorDxfStack: () => mockStack() }));
jest.mock('../../stores/ViewMode3DStore', () => ({
  useViewMode3DStore: { getState: () => ({ floor3DScope: 'all' }) },
}));
jest.mock('../../stores/DxfOverlay3DStore', () => ({
  useDxfOverlay3DStore: { getState: () => ({ dxfScene: null }) },
}));
jest.mock('../../../systems/levels/active-storey-store', () => ({
  useActiveStoreyStore: { getState: () => ({ context: null }) },
}));

import { findDxfEntitiesInScope, findDxfEntityInScope } from '../dxf-3d-floor-scope';

const line = (id: string): DxfEntityUnion => ({
  id, type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
} as DxfEntityUnion);

const scene = (entities: DxfEntityUnion[]): DxfScene =>
  ({ entities, layers: [], bounds: null, units: 'mm' } as unknown as DxfScene);

const floor = (entities: DxfEntityUnion[], floorElevationMm: number) =>
  ({ scene: scene(entities), floorElevationMm, levelId: null });

describe('findDxfEntitiesInScope (ADR-717)', () => {
  beforeEach(() => mockStack.mockReset());

  it('κενή είσοδος ⇒ κενό αποτέλεσμα, ΧΩΡΙΣ να διαβάσει καν την εμβέλεια', () => {
    mockStack.mockImplementation(() => { throw new Error('δεν έπρεπε να κληθεί'); });
    expect(findDxfEntitiesInScope([])).toEqual([]);
  });

  it('διατηρεί τη ΣΕΙΡΑ ΤΟΥ ΚΑΛΟΥΝΤΟΣ, όχι τη σειρά της σκηνής', () => {
    mockStack.mockReturnValue([floor([line('a'), line('b'), line('c')], 0)]);
    expect(findDxfEntitiesInScope(['c', 'a']).map((e) => e.entity.id)).toEqual(['c', 'a']);
  });

  it('παραλείπει τα ids που δεν υπάρχουν — ΔΕΝ μηδενίζει το αποτέλεσμα', () => {
    // Το «όλα ή τίποτα» ήταν ακριβώς το φίλτρο που έκανε τη ΜΕΙΚΤΗ επιλογή (BIM + raw DXF,
    // ADR-692 Φ2) να χάνει ΚΑΘΕ grip. Μια αστοχία αφορά ΜΟΝΟ το δικό της id.
    mockStack.mockReturnValue([floor([line('a')], 0)]);
    const res = findDxfEntitiesInScope(['a', 'φάντασμα']);
    expect(res.map((e) => e.entity.id)).toEqual(['a']);
  });

  it('πολλαπλοί όροφοι: κάθε οντότητα φέρει ΤΟ ΔΙΚΟ ΤΗΣ υψόμετρο + σκηνή', () => {
    mockStack.mockReturnValue([floor([line('κάτω')], 0), floor([line('πάνω')], 3000)]);
    const res = findDxfEntitiesInScope(['πάνω', 'κάτω']);
    expect(res.map((e) => [e.entity.id, e.floorElevationMm])).toEqual([['πάνω', 3000], ['κάτω', 0]]);
  });

  it('διπλό id σε δύο ορόφους: ΝΙΚΑ Ο ΠΡΩΤΟΣ (ίδιο συμβόλαιο με τον per-id resolver)', () => {
    mockStack.mockReturnValue([floor([line('ίδιο')], 0), floor([line('ίδιο')], 3000)]);
    expect(findDxfEntitiesInScope(['ίδιο'])[0].floorElevationMm).toBe(0);
    expect(findDxfEntityInScope('ίδιο')?.floorElevationMm).toBe(0);
  });

  it('ΕΝΑ πέρασμα: δεν ξαναδιαβάζει την εμβέλεια ανά id (η εγγύηση O(N+M))', () => {
    mockStack.mockReturnValue([floor([line('a'), line('b')], 0)]);
    findDxfEntitiesInScope(['a', 'b']);
    expect(mockStack).toHaveBeenCalledTimes(1);
  });

  it('σταματά μόλις τοποθετηθούν όλα τα ids — δεν σαρώνει περιττούς ορόφους', () => {
    const untouched = jest.fn(() => [] as DxfEntityUnion[]);
    mockStack.mockReturnValue([
      floor([line('a')], 0),
      { scene: { get entities() { return untouched(); }, layers: [], bounds: null, units: 'mm' } as unknown as DxfScene,
        floorElevationMm: 3000, levelId: null },
    ]);
    findDxfEntitiesInScope(['a']);
    expect(untouched).not.toHaveBeenCalled();
  });

  it('per-id wrapper: άγνωστο id ⇒ null (back-compat συμβόλαιο)', () => {
    mockStack.mockReturnValue([floor([line('a')], 0)]);
    expect(findDxfEntityInScope('όχι-εδώ')).toBeNull();
  });
});
