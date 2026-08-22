/**
 * ADR-789 — **Το λεξιλόγιο της κάτοψης δέχεται ό,τι εκθέτει x/y, χωρίς μετατροπή.**
 *
 * Γιατί υπάρχει αυτή η άγκυρα: μέχρι 2026-08-22 όλη η επιφάνεια `polygon-utils` δήλωνε
 * `readonly BimPoint[]` ενώ **δεν διάβαζε `.z` ούτε μία φορά**. Το ψέμα της υπογραφής το
 * πλήρωναν οι καλούντες με **89 ωμά `{ x: p.x, y: p.y, z: 0 }` σε 67 αρχεία**, πέντε
 * ιδιωτικά `lift`/`toXY`, δύο `polygon2D*` wrappers, ένα `as readonly BimPoint[]` cast και
 * δύο διπλότυπα `polygonBbox(readonly Point2D[])` (ADR-793: το `polygonBbox` διαγράφηκε — `planBoundsOf`).
 *
 * ⚠️ Χωρίς αυτό το αρχείο, η επιστροφή στο `BimPoint[]` **δεν σπάει τίποτα**: κάθε
 * υπάρχων καλών περνά `BimPoint`, άρα όλα τα άλλα tests μένουν πράσινα και η ρύθμιση
 * ξαναγυρίζει σιωπηλά. Η άγκυρα ασκεί την **αντίθετη** κατεύθυνση — 2Δ είσοδο — που
 * είναι ακριβώς η κατεύθυνση που ήταν κλειστή.
 *
 * ⚠️ Οι δηλώσεις τύπου (`const p: readonly Point2D[]`) **είναι μέρος του test**: αν κάποιος
 * στενέψει ξανά την υπογραφή, ο μεταγλωττιστής κοκκινίζει εδώ πριν κοκκινίσει το runtime.
 */
import type { Point2D } from '../../../../rendering/types/Types';
import type { PlanarPoint, BimPoint } from '../../../types/bim-base';
import {
  isConvexPolygon,
  isPolygonCCW,
  isPolygonSelfIntersecting,
  minPolygonInteriorAngleDeg,
  pointInPolygon,
  polygonArea,
  polygonAreaCentroid,
  polygonCentroid,
  polygonPerimeter,
  projectVerticesTo2D,
  shoelaceArea,
} from '../polygon-utils';
import { clipPolygonByConvex2D, polygonIntersectionAreaMm2 } from '../polygon-clip-utils';
import { bboxOf, bboxOfAll, planBoundsOf } from '../xy-bounds';

/** Το ΙΔΙΟ τετράγωνο 100×100 CCW, στα τρία σχήματα που κυκλοφορούν στο δέντρο. */
const AS_2D: readonly Point2D[] = [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
];
const AS_PLANAR: readonly PlanarPoint[] = AS_2D;
/** Το ίδιο σχήμα ΜΕ z — και μάλιστα z ≠ 0, ώστε να αποδειχθεί ότι το z αγνοείται. */
const AS_3D_NONZERO: readonly BimPoint[] = AS_2D.map((p) => ({ ...p, z: 4242 }));

describe('ADR-789 — Α. το 2Δ σχήμα περνά ΧΩΡΙΣ lift', () => {
  it('Α1. εμβαδόν / περίμετρος / winding δέχονται readonly Point2D[]', () => {
    expect(polygonArea(AS_2D)).toBe(10_000);
    expect(shoelaceArea(AS_2D)).toBe(10_000);
    expect(polygonPerimeter(AS_2D)).toBe(400);
    expect(isPolygonCCW(AS_2D)).toBe(true);
  });

  it('Α2. κέντρα δέχονται readonly Point2D[]', () => {
    expect(polygonCentroid(AS_2D)).toEqual({ x: 50, y: 50 });
    expect(polygonAreaCentroid(AS_2D)).toEqual({ x: 50, y: 50 });
  });

  it('Α3. bbox / κυρτότητα / γωνία / αυτοτομή / point-in-polygon δέχονται readonly Point2D[]', () => {
    const bb = planBoundsOf(AS_2D);
    expect([bb.min.x, bb.min.y, bb.max.x, bb.max.y]).toEqual([0, 0, 100, 100]);
    expect(isConvexPolygon(AS_2D)).toBe(true);
    expect(minPolygonInteriorAngleDeg(AS_2D)).toBeCloseTo(90);
    expect(isPolygonSelfIntersecting(AS_2D)).toBe(false);
    expect(pointInPolygon({ x: 50, y: 50 }, AS_2D)).toBe(true);
  });

  it('Α4. clipping + xy-bounds δέχονται readonly Point2D[]', () => {
    expect(polygonIntersectionAreaMm2(AS_2D, AS_2D)).toBeCloseTo(10_000);
    expect(clipPolygonByConvex2D(AS_2D, AS_2D)).toHaveLength(4);
    expect(bboxOf(AS_2D)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(bboxOfAll(AS_2D, AS_PLANAR)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 });
  });
});

describe('ADR-789 — Β. το 3Δ σχήμα ΕΞΑΚΟΛΟΥΘΕΙ να περνά (μηδέν regression για 223 importers)', () => {
  it('Β1. τα ίδια αποτελέσματα με BimPoint είσοδο', () => {
    expect(polygonArea(AS_3D_NONZERO)).toBe(10_000);
    expect(polygonCentroid(AS_3D_NONZERO)).toEqual({ x: 50, y: 50 });
    expect(isPolygonCCW(AS_3D_NONZERO)).toBe(true);
  });

  it('Β2. 🔑 το z ΑΓΝΟΕΙΤΑΙ — z=4242 δίνει ό,τι και η απουσία z', () => {
    expect(polygonArea(AS_3D_NONZERO)).toBe(polygonArea(AS_2D));
    expect(polygonPerimeter(AS_3D_NONZERO)).toBe(polygonPerimeter(AS_2D));
    expect(planBoundsOf(AS_3D_NONZERO)).toEqual(planBoundsOf(AS_2D));
    expect(polygonAreaCentroid(AS_3D_NONZERO)).toEqual(polygonAreaCentroid(AS_2D));
  });

  it('Β3. η προβολή ΠΑΝΤΑ πετά το z (φρέσκα αντικείμενα, ποτέ alias)', () => {
    const out = projectVerticesTo2D(AS_3D_NONZERO);
    expect(out).toEqual(AS_2D);
    for (const p of out) expect('z' in p).toBe(false);
    expect(out[0]).not.toBe(AS_3D_NONZERO[0]);
  });
});

/**
 * 🔑 Ο **ζωντανός** φρουρός.
 *
 * ⚠️ Τα Α1-Α4 παραπάνω είναι άγκυρες **χρόνου μεταγλώττισης**: το jest σβήνει τους τύπους,
 * άρα θα έμεναν πράσινα ακόμα κι αν κάποιος ξαναστένευε την υπογραφή σε `BimPoint[]`.
 * Πράσινο test που δεν μπορεί να κοκκινίσει είναι σχόλιο.
 *
 * Αυτό το block κλείνει το κενό χωρίς μεταγλωττιστή: περνά κορυφές των οποίων το `z` είναι
 * **getter που πετάει**. Αν οποιαδήποτε συνάρτηση της επιφάνειας κάτοψης αγγίξει το `z` —
 * έστω για να το αντιγράψει — το test σκάει και ονομάζει τη συνάρτηση.
 */
describe('ADR-789 — Δ. ΖΩΝΤΑΝΗ απόδειξη: καμία συνάρτηση κάτοψης δεν ΑΓΓΙΖΕΙ το z', () => {
  /** Σημείο που καταγγέλλει κάθε ανάγνωση του `z`. */
  function zTrap(x: number, y: number): PlanarPoint {
    return Object.defineProperties({} as PlanarPoint, {
      x: { value: x, enumerable: true },
      y: { value: y, enumerable: true },
      z: {
        enumerable: true,
        get(): never {
          throw new Error('ADR-789 παραβίαση: συνάρτηση κάτοψης διάβασε το .z');
        },
      },
    });
  }

  const TRAPPED: readonly PlanarPoint[] = [
    zTrap(0, 0), zTrap(100, 0), zTrap(100, 100), zTrap(0, 100),
  ];

  const SURFACE: ReadonlyArray<readonly [string, () => unknown]> = [
    ['shoelaceArea', () => shoelaceArea(TRAPPED)],
    ['polygonArea', () => polygonArea(TRAPPED)],
    ['polygonPerimeter', () => polygonPerimeter(TRAPPED)],
    ['isPolygonCCW', () => isPolygonCCW(TRAPPED)],
    ['planBoundsOf', () => planBoundsOf(TRAPPED)],
    ['polygonCentroid', () => polygonCentroid(TRAPPED)],
    ['polygonAreaCentroid', () => polygonAreaCentroid(TRAPPED)],
    ['isConvexPolygon', () => isConvexPolygon(TRAPPED)],
    ['minPolygonInteriorAngleDeg', () => minPolygonInteriorAngleDeg(TRAPPED)],
    ['isPolygonSelfIntersecting', () => isPolygonSelfIntersecting(TRAPPED)],
    ['pointInPolygon', () => pointInPolygon(zTrap(50, 50), TRAPPED)],
    ['projectVerticesTo2D', () => projectVerticesTo2D(TRAPPED)],
    ['bboxOf', () => bboxOf(TRAPPED)],
    ['bboxOfAll', () => bboxOfAll(TRAPPED, TRAPPED)],
    ['polygonIntersectionAreaMm2', () => polygonIntersectionAreaMm2(TRAPPED, TRAPPED)],
  ];

  it.each(SURFACE)('Δ. %s δεν αγγίζει το z', (_name, call) => {
    expect(call).not.toThrow();
  });

  it('Δ0. ο ίδιος ο φρουρός ΜΠΟΡΕΙ να πυροδοτήσει (απόδειξη ζωής)', () => {
    expect(() => (TRAPPED[0] as { z?: number }).z).toThrow(/ADR-789 παραβίαση/);
  });
});

describe('ADR-789 — Γ. τα καταργημένα workarounds ΔΕΝ επιστρέφουν', () => {
  it('Γ1. τα polygon2D* wrappers έχουν σβήσει — ένα όνομα ανά ερώτημα (ADR-749)', async () => {
    const mod: Record<string, unknown> = await import('../polygon-utils');
    expect(mod['polygon2DCentroid']).toBeUndefined();
    expect(mod['polygon2DAreaCentroid']).toBeUndefined();
  });

  it('Γ2. το bathroom-layout δεν εξάγει πια δημόσιο lift()', async () => {
    const mod: Record<string, unknown> = await import('../../../../systems/bathroom-layout/layout-geometry');
    expect(mod['lift']).toBeUndefined();
  });
});
