/**
 * ADR-937 2026-11-13 — Άγκυρες του ΕΝΟΣ SSoT κελύφους (`envelope-topology.ts`).
 *
 *   Τ1  κλειστό τετράγωνο ⇒ ένα όριο που περικλείει χώρο· και οι 4 τοίχοι βλέπουν έξω αέρα
 *   Τ2  εσωτερικός τοίχος που ακουμπά το κέλυφος βλέπει ΔΩΜΑΤΙΑ ⇒ ΔΕΝ είναι εξωτερικός
 *       (ο αποσυρμένος γράφος τοίχων τον μετρούσε εξωτερικό — λάθος θερμικά φορτία)
 *   Τ3  κενό 1 m στην περίμετρο ⇒ ανοιχτή δομή, κανένα όριο· κολώνα που γεμίζει το κενό ⇒ κλείνει
 *   Τ4  εσοχή (λωρίδα κοινόχρηστης σκάλας, απόφαση Giorgio (ii)) ⇒ μένει ΕΞΩ από το όριο — όχι convex hull
 *   Τ5  αίθριο: ακάλυπτη τρύπα ⇒ οι τοίχοι του βλέπουν έξω αέρα· σκεπασμένη ⇒ δωμάτιο
 *   Τ6  κενή είσοδος ⇒ κενή τοπολογία
 */

import {
  enclosedExteriorRings,
  hasOpenStructure,
  outsideAirEntityIds,
  resolveEnvelopeTopology,
} from '../envelope-topology';
import { pointInPolygon } from '../shared/polygon-utils';
import type { ColumnForEnvelope, WallForEnvelope } from '../envelope-types';
import type { SlabRegionFootprint } from '../footprint-region-classifier';
import type { BimPoint } from '../../types/bim-base';
import type { ColumnParams } from '../../types/column-types';

const p = (x: number, y: number): BimPoint => ({ x, y, z: 0 });

function wall(id: string, start: BimPoint, end: BimPoint, thickness = 200): WallForEnvelope {
  return {
    id,
    kind: 'straight',
    params: {
      category: 'exterior', start, end, height: 3000, thickness, flip: false,
      sceneUnits: 'mm', baseBinding: 'storey-floor', topBinding: 'storey-ceiling',
      baseOffset: 0, topOffset: 0,
    },
  };
}

function column(id: string, x: number, y: number, width: number, depth: number): ColumnForEnvelope {
  return {
    id,
    params: {
      kind: 'rectangular', position: { x, y, z: 0 }, anchor: 'center',
      width, depth, height: 3000, rotation: 0, sceneUnits: 'mm',
      baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    } as ColumnParams,
  };
}

const S = 10_000;
const SQUARE: readonly WallForEnvelope[] = [
  wall('s', p(0, 0), p(S, 0)),
  wall('e', p(S, 0), p(S, S)),
  wall('n', p(S, S), p(0, S)),
  wall('w', p(0, S), p(0, 0)),
];

describe('envelope-topology — το ΕΝΑ SSoT κελύφους', () => {
  it('Τ1 κλειστό τετράγωνο ⇒ ένα όριο, 4 εξωτερικοί τοίχοι', () => {
    const t = resolveEnvelopeTopology(SQUARE, [], []);
    expect(enclosedExteriorRings(t)).toHaveLength(1);
    expect(hasOpenStructure(t)).toBe(false);
    expect([...outsideAirEntityIds(t)].sort()).toEqual(['e', 'n', 's', 'w']);
  });

  it('Τ2 εσωτερικός τοίχος που ακουμπά το κέλυφος ΔΕΝ είναι εξωτερικός', () => {
    const partition = wall('part', p(S / 2, 0), p(S / 2, S));
    const t = resolveEnvelopeTopology([...SQUARE, partition], [], []);
    expect(enclosedExteriorRings(t)).toHaveLength(1);
    expect(outsideAirEntityIds(t).has('part')).toBe(false);
    expect(outsideAirEntityIds(t).has('s')).toBe(true);
  });

  it('Τ3 κενό 1 m ⇒ ανοιχτή δομή· η κολώνα που το γεμίζει κλείνει το κέλυφος', () => {
    const gapped = [
      wall('s1', p(0, 0), p(4_000, 0)),
      wall('s2', p(5_000, 0), p(S, 0)),
      ...SQUARE.slice(1),
    ];
    const open = resolveEnvelopeTopology(gapped, [], []);
    expect(enclosedExteriorRings(open)).toHaveLength(0);
    expect(hasOpenStructure(open)).toBe(true);

    // Βάθος 400 > πάχος τοίχου: η παρειά της κολώνας προεξέχει ⇒ δική της ακμή. (Συνευθειακές παρειές
    // συγχωνεύονται από την ένωση και η απόδοση-με-μέσο δίνει την ενιαία ακμή σε ΕΝΑ στοιχείο — best-effort.)
    const pier = column('c1', 4_500, 0, 1_200, 400);
    const closed = resolveEnvelopeTopology(gapped, [pier], []);
    expect(enclosedExteriorRings(closed)).toHaveLength(1);
    expect(hasOpenStructure(closed)).toBe(false);
    expect(outsideAirEntityIds(closed, 'column').has('c1')).toBe(true);
  });

  it('Τ4 εσοχή (λωρίδα σκάλας) μένει ΕΞΩ από το όριο', () => {
    const recessed = [
      wall('s1', p(0, 0), p(4_000, 0)),
      wall('s2', p(5_200, 0), p(S, 0)),
      wall('stripW', p(4_000, 0), p(4_000, 4_000)),
      wall('stripE', p(5_200, 0), p(5_200, 4_000)),
      wall('stripTop', p(4_000, 4_000), p(5_200, 4_000)),
      ...SQUARE.slice(1),
    ];
    const t = resolveEnvelopeTopology(recessed, [], []);
    const rings = enclosedExteriorRings(t);
    expect(rings).toHaveLength(1);
    const boundary = rings[0].points.points;
    expect(pointInPolygon(p(4_600, 2_000), boundary)).toBe(false); // μέσα στη λωρίδα = έξω
    expect(pointInPolygon(p(2_000, 6_000), boundary)).toBe(true); // διαμέρισμα = μέσα
    expect(outsideAirEntityIds(t).has('stripW')).toBe(true);
    expect(outsideAirEntityIds(t).has('stripTop')).toBe(true);
  });

  it('Τ5 ακάλυπτο αίθριο ⇒ οι τοίχοι του βλέπουν έξω αέρα· σκεπασμένο ⇒ δωμάτιο', () => {
    const court = [
      wall('c-s', p(4_000, 4_000), p(6_000, 4_000)),
      wall('c-e', p(6_000, 4_000), p(6_000, 6_000)),
      wall('c-n', p(6_000, 6_000), p(4_000, 6_000)),
      wall('c-w', p(4_000, 6_000), p(4_000, 4_000)),
      wall('link', p(S / 2, 0), p(S / 2, 4_000)),
    ];
    const rect = (x0: number, y0: number, x1: number, y1: number): SlabRegionFootprint => ({
      polygon: [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)],
    });
    // Πλάκα από πάνω παντού ΕΚΤΟΣ από το αίθριο [4000..6000]².
    const aroundCourt = [
      rect(0, 0, 4_000, S), rect(6_000, 0, S, S), rect(4_000, 0, 6_000, 4_000), rect(4_000, 6_000, 6_000, S),
    ];
    const open = resolveEnvelopeTopology([...SQUARE, ...court], [], [], aroundCourt);
    expect(outsideAirEntityIds(open).has('c-n')).toBe(true);
    expect(outsideAirEntityIds(open).has('link')).toBe(false);

    const covered = resolveEnvelopeTopology([...SQUARE, ...court], [], [], [rect(0, 0, S, S)]);
    expect(outsideAirEntityIds(covered).has('c-n')).toBe(false);
    expect(outsideAirEntityIds(covered).has('s')).toBe(true);
  });

  it('Τ6 κενή είσοδος ⇒ κενή τοπολογία', () => {
    const t = resolveEnvelopeTopology([], [], []);
    expect(enclosedExteriorRings(t)).toHaveLength(0);
    expect(hasOpenStructure(t)).toBe(false);
    expect(outsideAirEntityIds(t).size).toBe(0);
  });
});
