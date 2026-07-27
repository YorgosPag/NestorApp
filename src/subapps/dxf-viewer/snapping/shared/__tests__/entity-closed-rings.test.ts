/**
 * ADR-662 — Έλξεις (OSNAP) σε οντότητες οριζόμενες από κλειστά δαχτυλίδια ορίου.
 *
 * Κλειδώνει ΔΥΟ πράγματα μαζί:
 *   1. Το `entityClosedRings` SSoT απαντά «ποια rings» για γραμμοσκίαση (`boundaryPaths`)
 *      ΚΑΙ τοπογραφική επιφάνεια (`footprint`) — και **κενό** για ό,τι άλλο (ιδίως για την
 *      κλειστή πολυγραμμή, που έχει δικούς της κλάδους: διπλή καταμέτρηση = διπλές έλξεις).
 *   2. Οι δύο τύποι παράγουν **ταυτόσημες** έλξεις μέσα από τον ΕΝΑ κλάδο των καταναλωτών
 *      (ENDPOINT / MIDPOINT / CENTER / NEAREST / PERPENDICULAR). Αν κάποιος ξαναγράψει
 *      per-type κλάδο (sibling clone, N.18) και αποκλίνει, το `describe.each` το δείχνει.
 *
 * Το ADR-507 lock της γραμμοσκίασης ζει χωριστά (`geometric-calculations-hatch.test.ts`)
 * και μένει άθικτο — εδώ ελέγχεται η **κοινή** διαδρομή, όχι ξανά η γραμμοσκίαση.
 */

import { GeometricCalculations } from '../GeometricCalculations';
import { entityClosedRings } from '../entity-closed-rings';
import { nearestFootOnClosedRings, perpendicularFeetOverClosedRings } from '../polyline-perpendicular-feet';
import type { Entity } from '../../extended-types';
import type { Point2D } from '../../../rendering/types/Types';

// Ορθογώνιο περίγραμμα + μία νησίδα. Κανένα ring δεν επαναλαμβάνει την πρώτη κορυφή.
const OUTER: Point2D[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 60 },
  { x: 0, y: 60 },
];
const ISLAND: Point2D[] = [
  { x: 20, y: 20 },
  { x: 40, y: 20 },
  { x: 40, y: 40 },
];

const topoSurface = (footprint: Point2D[][]): Entity => ({
  id: 'topo-surface-existing', type: 'topo-surface', layerId: 'lyr_topo',
  surfaceId: 'existing', footprint,
} as unknown as Entity);

const hatch = (boundaryPaths: Point2D[][]): Entity => ({
  id: 'h1', type: 'hatch', layerId: 'lyr_hatch', boundaryPaths,
} as unknown as Entity);

/** Οι δύο ring-bounded τύποι — ίδιο σχήμα δεδομένων, άλλο όνομα πεδίου. */
const RING_BOUNDED: ReadonlyArray<[string, (rings: Point2D[][]) => Entity]> = [
  ['τοπογραφική επιφάνεια (footprint)', topoSurface],
  ['γραμμοσκίαση (boundaryPaths)', hatch],
];

describe('entityClosedRings — ποιες οντότητες έχουν κλειστά δαχτυλίδια ορίου', () => {
  it.each(RING_BOUNDED)('%s → τα rings ΩΜΑ, χωρίς μετασχηματισμό', (_label, make) => {
    expect(entityClosedRings(make([OUTER, ISLAND]))).toEqual([OUTER, ISLAND]);
  });

  it('κλειστή πολυγραμμή → κενό (έχει δικό της κλάδο· αλλιώς διπλές έλξεις)', () => {
    const closedPolyline = {
      id: 'p1', type: 'lwpolyline', layerId: 'lyr_p', vertices: OUTER, closed: true,
    } as unknown as Entity;
    expect(entityClosedRings(closedPolyline)).toHaveLength(0);
  });

  it('γραμμή → κενό (καμία αλλαγή στις υπάρχουσες έλξεις)', () => {
    const line = {
      id: 'l1', type: 'line', layerId: 'lyr_l', start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
    } as unknown as Entity;
    expect(entityClosedRings(line)).toHaveLength(0);
  });
});

describe.each(RING_BOUNDED)('Έλξεις μέσω του ΕΝΟΣ κλάδου — %s', (_label, make) => {
  it('ENDPOINT = ΚΑΘΕ κορυφή ΚΑΘΕ ring (οι κορυφές του περιγράμματος)', () => {
    expect(GeometricCalculations.getEntityEndpoints(make([OUTER, ISLAND])))
      .toEqual([...OUTER, ...ISLAND]);
  });

  it('MIDPOINT = μέσα ακμών ΜΕ την ακμή κλεισίματος (last→first)', () => {
    expect(GeometricCalculations.getEntityMidpoints(make([OUTER]))).toEqual([
      { x: 50, y: 0 },   // (0,0)→(100,0)
      { x: 100, y: 30 }, // (100,0)→(100,60)
      { x: 50, y: 60 },  // (100,60)→(0,60)
      { x: 0, y: 30 },   // ΑΚΜΗ ΚΛΕΙΣΙΜΑΤΟΣ (0,60)→(0,0) — χάνεται αν λείψει το closed=true
    ]);
  });

  it('CENTER = κέντρο bbox ΟΛΩΝ των rings (ένα κέντρο, όχι ένα ανά ring)', () => {
    expect(GeometricCalculations.getEntityCenter(make([OUTER, ISLAND]))).toEqual({ x: 50, y: 30 });
  });

  it('κενό όριο → καμία έλξη, κανένα κέντρο', () => {
    expect(GeometricCalculations.getEntityEndpoints(make([]))).toHaveLength(0);
    expect(GeometricCalculations.getEntityMidpoints(make([]))).toHaveLength(0);
    expect(GeometricCalculations.getEntityCenter(make([]))).toBeNull();
  });
});

describe('nearestFootOnClosedRings — NEAREST πάνω στη γραμμή του ορίου', () => {
  it('cursor έξω από την επιφάνεια → foot πάνω στην κοντινότερη ακμή', () => {
    expect(nearestFootOnClosedRings([OUTER], { x: 50, y: -5 })).toEqual({ x: 50, y: 0 });
  });

  it('νικά το ΚΟΝΤΙΝΟΤΕΡΟ ring, όχι το πρώτο (νησίδα μέσα στο περίγραμμα)', () => {
    expect(nearestFootOnClosedRings([OUTER, ISLAND], { x: 30, y: 22 })).toEqual({ x: 30, y: 20 });
  });

  it('η ακμή κλεισίματος συμμετέχει σαν κάθε άλλη', () => {
    expect(nearestFootOnClosedRings([OUTER], { x: -4, y: 30 })).toEqual({ x: 0, y: 30 });
  });

  it('clamped: cursor πέρα από κορυφή → η κορυφή, όχι η προέκταση', () => {
    expect(nearestFootOnClosedRings([OUTER], { x: -10, y: -10 })).toEqual({ x: 0, y: 0 });
  });

  it('κενό όριο ή εκφυλισμένο ring → null', () => {
    expect(nearestFootOnClosedRings([], { x: 0, y: 0 })).toBeNull();
    expect(nearestFootOnClosedRings([[{ x: 1, y: 1 }]], { x: 0, y: 0 })).toBeNull();
  });
});

describe('perpendicularFeetOverClosedRings — PERPENDICULAR στις ακμές του ορίου', () => {
  it('ένα foot ανά ακμή, ΜΕ την ακμή κλεισίματος (4 ακμές σε 4 κορυφές)', () => {
    const feet = perpendicularFeetOverClosedRings([OUTER], { x: 50, y: -5 }, 1000);
    expect(feet.map((f) => f.segmentIndex)).toEqual([0, 1, 2, 3]);
    expect(feet.every((f) => f.ringIndex === 0)).toBe(true);
  });

  it('unclamped: το foot επιτρέπεται στην ΠΡΟΕΚΤΑΣΗ της ακμής (AutoCAD σημασιολογία)', () => {
    const feet = perpendicularFeetOverClosedRings([OUTER], { x: 150, y: -5 }, 1000);
    // Κάτω ακμή (0,0)→(100,0): το foot (150,0) είναι ΕΞΩ από το τμήμα.
    expect(feet.find((f) => f.segmentIndex === 0)?.point).toEqual({ x: 150, y: 0 });
  });

  it('φιλτράρεται από το maxDistance', () => {
    const feet = perpendicularFeetOverClosedRings([OUTER], { x: 50, y: -5 }, 10);
    expect(feet).toHaveLength(1);
    expect(feet[0].point).toEqual({ x: 50, y: 0 });
  });

  it('κάθε ring αριθμείται ξεχωριστά (ringIndex)', () => {
    const feet = perpendicularFeetOverClosedRings([OUTER, ISLAND], { x: 30, y: 22 }, 1000);
    expect(new Set(feet.map((f) => f.ringIndex))).toEqual(new Set([0, 1]));
  });
});
