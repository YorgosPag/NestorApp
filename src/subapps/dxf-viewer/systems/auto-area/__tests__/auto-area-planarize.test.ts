/**
 * ADR-507 Φ3 — planarization/noding: γραμμές που ΤΕΜΝΟΝΤΑΙ στη μέση (κάτοψη «σκάρα»)
 * πρέπει να σπάνε στα σημεία τομής ώστε ο half-edge face traversal να βρίσκει τα
 * δωμάτια. Πριν τη διόρθωση, μόνο τα άκρο-με-άκρο σχήματα έκλειναν.
 */

import { findClosedPolygonsFromLines } from '../auto-area-geometry';
import { getAutoAreaHitResult } from '../auto-area-hit';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

function line(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return { id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as unknown as Entity;
}

// «#» (hash/σκάρα): 2 κάθετες × 2 οριζόντιες που τέμνονται· κεντρικό κελί 10×10.
const HASH: ReadonlyArray<readonly [Point2D, Point2D]> = [
  [{ x: 10, y: 0 }, { x: 10, y: 30 }],
  [{ x: 20, y: 0 }, { x: 20, y: 30 }],
  [{ x: 0, y: 10 }, { x: 30, y: 10 }],
  [{ x: 0, y: 20 }, { x: 30, y: 20 }],
];

describe('findClosedPolygonsFromLines — planarization (crossing lines)', () => {
  it('βρίσκει το κεντρικό κελί μιας «σκάρα» (γραμμές που τέμνονται στη μέση)', () => {
    const faces = findClosedPolygonsFromLines(HASH, 0.001);
    // Το μόνο φραγμένο κελί είναι το κεντρικό 10×10 (εμβαδόν 100).
    const centerCell = faces.find((f) => {
      let area2 = 0;
      for (let i = 0; i < f.length; i++) {
        const j = (i + 1) % f.length;
        area2 += f[i].x * f[j].y - f[j].x * f[i].y;
      }
      return Math.abs(area2 / 2 - 100) < 1e-6;
    });
    expect(centerCell).toBeDefined();
  });

  it('χωρίς τομές (άκρα μη ενωμένα) → καμία όψη (μη-regression του endpoint path)', () => {
    // Δύο παράλληλες γραμμές που δεν τέμνονται ούτε ενώνονται → 0 faces.
    const faces = findClosedPolygonsFromLines(
      [
        [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        [{ x: 0, y: 5 }, { x: 10, y: 5 }],
      ],
      0.001,
    );
    expect(faces).toHaveLength(0);
  });
});

// Εμβαδόν πολυγώνου (shoelace, απόλυτη τιμή).
function polyArea(p: ReadonlyArray<Point2D>): number {
  let a2 = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a2 += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(a2 / 2);
}

const countCells = (faces: Point2D[][], area: number, tol = 1e-6): number =>
  faces.filter((f) => Math.abs(polyArea(f) - area) < tol).length;

describe('findClosedPolygonsFromLines — tolerance-aware T-junction noding (ADR-507 Φ3)', () => {
  // Εξωτερικό ορθογώνιο 40×20 (κλειστό, άκρα στις γωνίες) + εσωτερικός διαχωριστής
  // στο x=20 που χωρίζει σε 2 κελιά 20×20. Ο διαχωριστής ΔΕΝ φτάνει τέλεια τους
  // πάνω/κάτω τοίχους — προσομοιώνει πραγματικό DXF (κενό ή overshoot).
  const OUTER: ReadonlyArray<readonly [Point2D, Point2D]> = [
    [{ x: 0, y: 0 }, { x: 40, y: 0 }],   // bottom
    [{ x: 40, y: 0 }, { x: 40, y: 20 }], // right
    [{ x: 40, y: 20 }, { x: 0, y: 20 }], // top
    [{ x: 0, y: 20 }, { x: 0, y: 0 }],   // left
  ];

  it('GAP: διαχωριστής 1 μονάδα ΠΡΙΝ τους τοίχους → κλείνει σε 2 κελιά με snapTol≥1', () => {
    const partitionGap: readonly [Point2D, Point2D] = [{ x: 20, y: 1 }, { x: 20, y: 19 }];
    const faces = findClosedPolygonsFromLines([...OUTER, partitionGap], 2);
    expect(countCells(faces, 400)).toBe(2);
  });

  it('GAP: ίδια γεωμετρία με snapTol μικρότερο του κενού → ΔΕΝ κλείνει (1 face)', () => {
    const partitionGap: readonly [Point2D, Point2D] = [{ x: 20, y: 1 }, { x: 20, y: 19 }];
    const faces = findClosedPolygonsFromLines([...OUTER, partitionGap], 0.5);
    // Μόνο το εξωτερικό 40×20=800· ο διαχωριστής αιωρείται.
    expect(countCells(faces, 400)).toBe(0);
    expect(countCells(faces, 800)).toBe(1);
  });

  it('OVERSHOOT: διαχωριστής ΠΕΡΑ από τους τοίχους → κλείνει σε 2 κελιά με snapTol≥1', () => {
    const partitionOver: readonly [Point2D, Point2D] = [{ x: 20, y: -1 }, { x: 20, y: 21 }];
    const faces = findClosedPolygonsFromLines([...OUTER, partitionOver], 2);
    expect(countCells(faces, 400)).toBe(2);
  });

  it('μη-regression: τέλεια ενωμένος διαχωριστής → 2 κελιά ανεξάρτητα από snapTol', () => {
    const partitionExact: readonly [Point2D, Point2D] = [{ x: 20, y: 0 }, { x: 20, y: 20 }];
    const faces = findClosedPolygonsFromLines([...OUTER, partitionExact], 0.001);
    expect(countCells(faces, 400)).toBe(2);
  });
});

function arc(id: string, cx: number, cy: number, r: number, startDeg: number, endDeg: number): Entity {
  return { id, type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle: startDeg, endAngle: endDeg } as unknown as Entity;
}

describe('getAutoAreaHitResult — καμπύλα όρια (τόξο/τεταρτημόριο)', () => {
  it('εντοπίζει τεταρτημόριο κλεισμένο από 2 ευθείες + τόξο 0°→90°', () => {
    // Τεταρτημόριο ακτίνας 1000: ευθείες στους άξονες + τόξο που τις ενώνει.
    const entities: Entity[] = [
      line('e1', 0, 0, 1000, 0),
      line('e2', 0, 0, 0, 1000),
      arc('a1', 0, 0, 1000, 0, 90), // (1000,0) → (0,1000)
    ];
    const hit = getAutoAreaHitResult({ x: 300, y: 300 }, entities, [], 1, 0);
    expect(hit).not.toBeNull();
    expect(hit!.polygon.length).toBeGreaterThanOrEqual(3);
  });

  it('χωρίς το τόξο (ανοιχτή γωνία) → καμία περιοχή (απόδειξη ότι το τόξο κλείνει το όριο)', () => {
    const entities: Entity[] = [
      line('e1', 0, 0, 1000, 0),
      line('e2', 0, 0, 0, 1000),
    ];
    const hit = getAutoAreaHitResult({ x: 300, y: 300 }, entities, [], 1, 0);
    expect(hit).toBeNull();
  });
});

describe('getAutoAreaHitResult — click μέσα σε «σκάρα» κελί', () => {
  it('εντοπίζει το κεντρικό κελί όταν οι τοίχοι είναι διασταυρούμενες γραμμές', () => {
    const entities: Entity[] = [
      line('v1', 10, 0, 10, 30),
      line('v2', 20, 0, 20, 30),
      line('h1', 0, 10, 30, 10),
      line('h2', 0, 20, 30, 20),
    ];
    const hit = getAutoAreaHitResult({ x: 15, y: 15 }, entities, [], 1, 0);
    expect(hit).not.toBeNull();
    // ~10×10 κελί.
    expect(hit!.polygon.length).toBeGreaterThanOrEqual(4);
  });
});
