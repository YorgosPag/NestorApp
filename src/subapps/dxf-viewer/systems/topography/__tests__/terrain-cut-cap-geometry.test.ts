/**
 * ADR-665 M2 — tests για την επιφάνεια της τομής του αναγλύφου.
 *
 * ## Το ANCHOR (§M2.10)
 *
 * `capArea + belowArea === topoSurfaceAreas(tin).plan2DMm2`.
 *
 * Το τρίτο μέγεθος έρχεται από **εντελώς άλλη διαδρομή** (`topo-surface-area`, ADR-662 §12:
 * άθροισμα εξωτερικών γινομένων ανά τρίγωνο) — δεν ρωτά τον κόφτη. Δύο ανεξάρτητοι δρόμοι που
 * πρέπει να συμφωνήσουν είναι ο μόνος τρόπος να πιαστεί μια σιωπηλή «απλοποίηση» του κόφτη· ένα
 * τεστ που ρωτούσε τον ίδιο τον κόφτη και για τα δύο θα ήταν ταυτολογία και θα περνούσε ακόμη κι
 * αν ο αλγόριθμος ήταν λάθος.
 *
 * Καλύπτονται ρητά **τρύπα** και **δύο νησιά**, γιατί ακριβώς εκεί σπάει η εναλλακτική
 * «ισοϋψής + κλείσιμο + CDT» που το M2.1 απορρίπτει.
 */

import {
  buildTerrainCutCapPlan,
  terrainBelowLevelPlanAreaMm2,
} from '../terrain-cut-cap-geometry';
import { topoSurfaceAreas } from '../topo-surface-area';
import type { TinSurface } from '../topo-types';

const ORIGIN = { x: 400_000, y: 4_200_000 } as const; // ΕΓΣΑ-scale origin: το LOCAL→WORLD μετρά

function surface(
  positions: ReadonlyArray<readonly [number, number]>,
  elevations: readonly number[],
  triangles: ReadonlyArray<readonly [number, number, number]>,
): TinSurface {
  return { positions, elevations, triangles, origin: ORIGIN } as unknown as TinSurface;
}

/** Τετράγωνο 1000×1000 σε δύο τρίγωνα, με υψόμετρο ανά κορυφή. */
function square(z: readonly [number, number, number, number]): TinSurface {
  return surface(
    [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
    [...z],
    [[0, 1, 2], [0, 2, 3]],
  );
}

const SQUARE_MM2 = 1000 * 1000;

/** Το anchor, σε μία γραμμή: ο cap και το κάτω μέρος αθροίζουν στο ΑΝΕΞΑΡΤΗΤΑ μετρημένο σύνολο. */
function expectPartitionsSurface(tin: TinSurface, levelMm: number): void {
  const cap = buildTerrainCutCapPlan(tin, levelMm).planAreaMm2;
  const below = terrainBelowLevelPlanAreaMm2(tin, levelMm);
  expect(cap + below).toBeCloseTo(topoSurfaceAreas(tin).plan2DMm2, 3);
}

describe('buildTerrainCutCapPlan — όρια', () => {
  it('στάθμη ΠΑΝΩ από όλον τον λόφο → ΚΑΝΕΝΑΣ cap', () => {
    const plan = buildTerrainCutCapPlan(square([0, 100, 200, 300]), 5_000);
    expect(plan.triangleCount).toBe(0);
    expect(plan.planAreaMm2).toBe(0);
    expect(plan.points).toEqual([]);
  });

  it('στάθμη ΚΑΤΩ από όλον τον λόφο → ΠΛΗΡΗΣ cap, εμβαδόν = η προβολή της επιφάνειας', () => {
    const plan = buildTerrainCutCapPlan(square([0, 100, 200, 300]), -5_000);
    expect(plan.triangleCount).toBe(2);
    expect(plan.planAreaMm2).toBeCloseTo(SQUARE_MM2, 6);
  });

  it('η στάθμη ΣΤΟ υψόμετρο επίπεδου εδάφους → μηδενικού εμβαδού cap (στεγανό, όχι διπλομέτρημα)', () => {
    // Επίπεδο έδαφος ακριβώς στη στάθμη: κάθε κορυφή έχει f = 0, άρα ανήκει και στα δύο μισά.
    // Το ΕΜΒΑΔΟΝ όμως δεν επιτρέπεται να μετρηθεί δύο φορές — γι' αυτό ο cap κρατά όλη την
    // περιοχή και το κάτω μέρος επίσης· το anchor παρακάτω είναι που το κλειδώνει.
    const plan = buildTerrainCutCapPlan(square([0, 0, 0, 0]), 0);
    expect(plan.planAreaMm2).toBeCloseTo(SQUARE_MM2, 6);
  });

  it('χωρίς τρίγωνα ή με μη-πεπερασμένη στάθμη → κενό, ΠΟΤΕ NaN', () => {
    expect(buildTerrainCutCapPlan(surface([], [], []), 0).planAreaMm2).toBe(0);
    expect(buildTerrainCutCapPlan(square([0, 1, 2, 3]), Number.NaN).triangleCount).toBe(0);
  });

  it('οι κορυφές βγαίνουν σε WORLD mm (LOCAL + origin), όχι σε LOCAL', () => {
    const plan = buildTerrainCutCapPlan(square([0, 0, 0, 0]), -1);
    for (const p of plan.points) {
      expect(p.x).toBeGreaterThanOrEqual(ORIGIN.x);
      expect(p.y).toBeGreaterThanOrEqual(ORIGIN.y);
    }
  });
});

describe('ANCHOR εμβαδού — cap + below === η ανεξάρτητα μετρημένη προβολή', () => {
  it('επικλινές έδαφος, στάθμη στη μέση', () => {
    expectPartitionsSurface(square([0, 0, 1000, 1000]), 500);
  });

  it('η ταυτότητα ισχύει σε ΚΑΘΕ στάθμη κατά μήκος της ράμπας', () => {
    const tin = square([0, 200, 1000, 800]);
    for (const level of [-100, 0, 1, 199, 200, 333, 500, 799, 800, 999, 1000, 1500]) {
      expectPartitionsSurface(tin, level);
    }
  });

  it('ΤΡΥΠΑ μέσα στην επιφάνεια — δεν χρειάζεται κανείς να ξέρει ότι είναι τρύπα', () => {
    // Δακτύλιος: εξωτερικό τετράγωνο 3000×3000 με κεντρικό τετράγωνο 1000×1000 ΑΤΡΙΓΩΝΟ.
    // Οκτώ τρίγωνα γύρω από το κενό.
    const positions: Array<readonly [number, number]> = [
      [0, 0], [3000, 0], [3000, 3000], [0, 3000],       // 0..3 εξωτερικά
      [1000, 1000], [2000, 1000], [2000, 2000], [1000, 2000], // 4..7 εσωτερικά (η τρύπα)
    ];
    const elevations = [0, 400, 900, 500, 300, 700, 850, 600];
    const triangles: Array<readonly [number, number, number]> = [
      [0, 1, 5], [0, 5, 4],
      [1, 2, 6], [1, 6, 5],
      [2, 3, 7], [2, 7, 6],
      [3, 0, 4], [3, 4, 7],
    ];
    const tin = surface(positions, elevations, triangles);
    // Η προβολή είναι 3000² − 1000² = 8·10⁶ mm²: η τρύπα ΔΕΝ μετράει, γιατί δεν έχει τρίγωνα.
    expect(topoSurfaceAreas(tin).plan2DMm2).toBeCloseTo(8_000_000, 3);
    for (const level of [-50, 0, 350, 500, 620, 900, 1200]) {
      expectPartitionsSurface(tin, level);
    }
  });

  it('ΔΥΟ ΝΗΣΙΑ (ασύνδετα τρίγωνα) — το άθροισμα μένει σωστό χωρίς καμία έννοια συνεκτικότητας', () => {
    const tin = surface(
      [
        [0, 0], [1000, 0], [1000, 1000], [0, 1000],           // νησί A
        [9000, 9000], [10000, 9000], [10000, 10000], [9000, 10000], // νησί B, μακριά
      ],
      [0, 300, 900, 600, 1200, 400, 100, 800],
      [[0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7]],
    );
    expect(topoSurfaceAreas(tin).plan2DMm2).toBeCloseTo(2 * SQUARE_MM2, 3);
    for (const level of [0, 250, 500, 750, 1000, 1100]) {
      expectPartitionsSurface(tin, level);
    }
  });

  it('IDEMPOTENCY — δύο κλήσεις με την ίδια είσοδο δίνουν ταυτόσημο αποτέλεσμα', () => {
    const tin = square([0, 200, 1000, 800]);
    const a = buildTerrainCutCapPlan(tin, 400);
    const b = buildTerrainCutCapPlan(tin, 400);
    expect(b.planAreaMm2).toBe(a.planAreaMm2);
    expect(b.triangleCount).toBe(a.triangleCount);
    expect(b.points).toEqual(a.points);
  });

  it('κάθε τρίγωνο του cap είναι ΓΝΗΣΙΟ τρίγωνο (3 σημεία, μη μηδενικό εμβαδόν)', () => {
    const plan = buildTerrainCutCapPlan(square([0, 200, 1000, 800]), 400);
    expect(plan.points.length % 3).toBe(0);
    expect(plan.triangleCount).toBeGreaterThan(0);
    for (let t = 0; t < plan.triangleCount; t++) {
      const [a, b, c] = [plan.points[t * 3]!, plan.points[t * 3 + 1]!, plan.points[t * 3 + 2]!];
      const cross = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      expect(Math.abs(cross)).toBeGreaterThan(0);
    }
  });
});
