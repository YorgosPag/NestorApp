/**
 * ADR-662 §12 — tests για τα δύο εμβαδά της τοπογραφικής επιφάνειας.
 *
 * Κλειδώνει τη σχέση που κάνει τον δεύτερο αριθμό να αξίζει: **επίπεδο έδαφος ⇒ 3D = 2D·
 * επικλινές ⇒ 3D > 2D**. Αν κάποιος «απλοποιήσει» το 3D σε shoelace, το τρίτο test κοκκινίζει.
 */

import { topoSurfaceAreas } from '../topo-surface-area';
import type { TinSurface } from '../topo-types';

/** Τετράγωνο 1000×1000 (LOCAL mm) σε δύο τρίγωνα· `z` = υψόμετρο ανά κορυφή. */
function squareSurface(z: readonly [number, number, number, number]): TinSurface {
  return {
    positions: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
    elevations: [...z],
    triangles: [[0, 1, 2], [0, 2, 3]],
  } as unknown as TinSurface;
}

const SQUARE_MM2 = 1_000 * 1_000;

describe('topoSurfaceAreas', () => {
  it('επίπεδο έδαφος → η επιφάνεια ΤΑΥΤΙΖΕΤΑΙ με την προβολή', () => {
    const a = topoSurfaceAreas(squareSurface([0, 0, 0, 0]));
    expect(a.plan2DMm2).toBeCloseTo(SQUARE_MM2, 6);
    expect(a.surface3DMm2).toBeCloseTo(SQUARE_MM2, 6);
    expect(a.triangleCount).toBe(2);
  });

  it('σταθερό υψόμετρο ≠ 0 → πάλι ίσα (μετράει η ΚΛΙΣΗ, όχι το ύψος)', () => {
    const a = topoSurfaceAreas(squareSurface([5000, 5000, 5000, 5000]));
    expect(a.surface3DMm2).toBeCloseTo(a.plan2DMm2, 6);
  });

  it('επικλινές έδαφος → η επιφάνεια ΞΕΠΕΡΝΑ την προβολή, ενώ η προβολή μένει ίδια', () => {
    const a = topoSurfaceAreas(squareSurface([0, 0, 1000, 1000]));
    // Ομοιόμορφη κλίση 45° κατά τον άξονα y ⇒ επιφάνεια = προβολή × √2.
    expect(a.plan2DMm2).toBeCloseTo(SQUARE_MM2, 6);
    expect(a.surface3DMm2).toBeCloseTo(SQUARE_MM2 * Math.SQRT2, 6);
    expect(a.surface3DMm2).toBeGreaterThan(a.plan2DMm2);
  });

  it('η προβολή ΔΕΝ αλλάζει με μετατόπιση (το εμβαδόν είναι αναλλοίωτο)', () => {
    const moved = {
      positions: [[7_000, -3_000], [8_000, -3_000], [8_000, -2_000], [7_000, -2_000]],
      elevations: [0, 0, 0, 0],
      triangles: [[0, 1, 2], [0, 2, 3]],
    } as unknown as TinSurface;
    expect(topoSurfaceAreas(moved).plan2DMm2).toBeCloseTo(SQUARE_MM2, 6);
  });

  it('χωρίς τρίγωνα → μηδενικά, ποτέ NaN', () => {
    const empty = { positions: [], elevations: [], triangles: [] } as unknown as TinSurface;
    const a = topoSurfaceAreas(empty);
    expect(a).toEqual({ plan2DMm2: 0, surface3DMm2: 0, triangleCount: 0 });
  });

  it('εκφυλισμένο τρίγωνο (συνευθειακό) → μηδενική συνεισφορά, όχι NaN', () => {
    const collinear = {
      positions: [[0, 0], [500, 0], [1000, 0]],
      elevations: [0, 0, 0],
      triangles: [[0, 1, 2]],
    } as unknown as TinSurface;
    const a = topoSurfaceAreas(collinear);
    expect(a.plan2DMm2).toBe(0);
    expect(a.surface3DMm2).toBe(0);
  });
});
