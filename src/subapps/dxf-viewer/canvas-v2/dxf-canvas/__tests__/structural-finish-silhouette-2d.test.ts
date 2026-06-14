// Stub Firebase auth chain before any imports — column-completion → entity build
// transitively touches firestore in test env.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

/**
 * ADR-449 Slice X2 μέρος Β — `buildStructuralFinishSilhouette2D` unit tests.
 *
 * Ο σοβάς (2Δ) τρέφεται πλέον από την ΙΔΙΑ merged-silhouette SSoT με το 3Δ
 * (`computeStructuralFinishSilhouette`). Επαληθεύουμε ότι ο per-frame builder:
 *  - δίνει bands με όψεις για κολόνα με ΕΝΕΡΓΟ σοβά (μεμονωμένη κολόνα = 4 όψεις),
 *  - δίνει `null` όταν κανένα στοιχείο δεν έχει ενεργό σοβά (μηδέν κόστος),
 *  - περνά σωστά τα `sceneUnits` του μέλους (το draw τα χρειάζεται για το offset).
 * Η γωνιακή γεωμετρία (miter) δοκιμάζεται στο `structural-finish-outline-geometry`
 * / `structural-finish-3d-beam`· η ένωση/silhouette στο `structural-finish-silhouette`.
 */

import { buildStructuralFinishSilhouette2D } from '../dxf-renderer-frame-builders';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import type { StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';
import type { DxfEntityUnion } from '../dxf-types';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function makeColumn(finish?: StructuralFinishSpec) {
  // ADR-449 Slice 5 — ρητό override του factory default finish (undefined χωρίς arg).
  const params = { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), finish };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

describe('buildStructuralFinishSilhouette2D (ADR-449 Slice X2 μέρος Β)', () => {
  it('μεμονωμένη κολόνα με ενεργό σοβά → bands με 4 όψεις (περίμετρος)', () => {
    const col = makeColumn(FINISH);
    const result = buildStructuralFinishSilhouette2D([col] as unknown as DxfEntityUnion[]);
    expect(result).not.toBeNull();
    const segs = result!.bands.flatMap((b) => b.faces.segments);
    expect(segs.length).toBe(4); // ορθογώνια κολόνα = 4 εκτεθειμένες όψεις
    expect(result!.sceneUnits).toBe(col.params.sceneUnits ?? 'mm');
  });

  it('κολόνα χωρίς σοβά → null (μηδέν κόστος)', () => {
    const col = makeColumn();
    expect(buildStructuralFinishSilhouette2D([col] as unknown as DxfEntityUnion[])).toBeNull();
  });

  it('κενή σκηνή → null', () => {
    expect(buildStructuralFinishSilhouette2D([])).toBeNull();
  });
});
