/**
 * ADR-713 — δειγματοληψία τελειωμένου εδάφους (tier 1 του cascade ζώνης έκθεσης).
 *
 * Κλειδώνει τα τρία που, αν σπάσουν, θάβουν ολόκληρο κτίριο ή δεν θάβουν τίποτα:
 * την αφαίρεση του vertical datum, την προτεραιότητα `proposed` → `existing`, και το ότι
 * «εκτός επιφάνειας» επιστρέφει `null` — **ποτέ 0**.
 */

import type { TinSurface } from '../topo-types';
import { resolveFinishedGradeAtWorldMm } from '../grade-at-plan-point';

/**
 * Οριζόντια επιφάνεια στη WORLD στάθμη `elevMm`, τετράγωνο [0,1000]² γύρω από το `origin`.
 * Δύο τρίγωνα — αρκετά για βαρυκεντρική δειγματοληψία σε όλο το τετράγωνο.
 */
function flatSurface(elevMm: number, origin = { x: 0, y: 0 }): TinSurface {
  return {
    positions: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
    elevations: [elevMm, elevMm, elevMm, elevMm],
    triangles: [[0, 1, 2], [0, 2, 3]],
    origin,
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, minZ: elevMm, maxZ: elevMm },
    flatTriangleCount: 0,
  };
}

/** Κενή επιφάνεια — «δεν υπάρχει τοπογραφικό». */
const EMPTY: TinSurface = {
  positions: [], elevations: [], triangles: [],
  origin: { x: 0, y: 0 },
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
  flatTriangleCount: 0,
};

describe('resolveFinishedGradeAtWorldMm', () => {
  it('αφαιρεί το vertical datum — αλλιώς ένα υψόμετρο +106m θάβει όλο το κτίριο', () => {
    const surveyElevMm = 106_000; // ~106 m πραγματικό υψόμετρο ΕΓΣΑ
    const datumMm = 106_300;      // internal z=0 == 106.3 m (το κτίριο κάθεται 300mm ψηλότερα)
    const z = resolveFinishedGradeAtWorldMm([flatSurface(surveyElevMm)], datumMm, 500, 500);
    // Building-relative: το έδαφος είναι 300mm ΚΑΤΩ από το internal μηδέν, όχι στα +106m.
    expect(z).toBe(-300);
  });

  it('η μελετημένη επιφάνεια ΥΠΕΡΙΣΧΥΕΙ της υπάρχουσας (τελειωμένο έδαφος)', () => {
    const proposed = flatSurface(-500);
    const existing = flatSurface(-2000);
    expect(resolveFinishedGradeAtWorldMm([proposed, existing], 0, 500, 500)).toBe(-500);
  });

  it('χωρίς μελετημένη → πέφτει στην υπάρχουσα', () => {
    expect(resolveFinishedGradeAtWorldMm([EMPTY, flatSurface(-2000)], 0, 500, 500)).toBe(-2000);
  });

  it('εκτός τριγωνισμού → null, ΠΟΤΕ 0 («δεν ξέρω» ≠ «έδαφος στο μηδέν»)', () => {
    expect(resolveFinishedGradeAtWorldMm([flatSurface(-500)], 0, 9_000_000, 9_000_000)).toBeNull();
  });

  it('κενή επιφάνεια σε όλα τα tiers → null (ο caller πέφτει στη σταθερά κτιρίου)', () => {
    expect(resolveFinishedGradeAtWorldMm([EMPTY, EMPTY], 0, 500, 500)).toBeNull();
  });

  it('εκτός τριγωνισμού στη μελετημένη → ΔΕΝ σταματά, ρωτά την υπάρχουσα', () => {
    // Μελετημένη μόνο γύρω από το (10000,10000)· το ερώτημα είναι στο (500,500).
    const proposed = flatSurface(-500, { x: 10_000, y: 10_000 });
    const existing = flatSurface(-2000);
    expect(resolveFinishedGradeAtWorldMm([proposed, existing], 0, 500, 500)).toBe(-2000);
  });

  it('η επιφάνεια δειγματοληπτείται σε WORLD (το origin ξαναπροβάλλεται)', () => {
    // Τοπικό τετράγωνο [0,1000]² με origin (50000, 50000) → καλύπτει WORLD [50000, 51000]².
    const tin = flatSurface(-800, { x: 50_000, y: 50_000 });
    expect(resolveFinishedGradeAtWorldMm([tin], 0, 50_500, 50_500)).toBe(-800);
    expect(resolveFinishedGradeAtWorldMm([tin], 0, 500, 500)).toBeNull();
  });

  it('μη-πεπερασμένο σημείο / datum → δεν διαρρέει NaN', () => {
    expect(resolveFinishedGradeAtWorldMm([flatSurface(-500)], 0, Number.NaN, 500)).toBeNull();
    const z = resolveFinishedGradeAtWorldMm([flatSurface(-500)], Number.NaN, 500, 500);
    expect(z).toBe(-500); // datum μη-πεπερασμένο → 0, όχι NaN
  });
});
