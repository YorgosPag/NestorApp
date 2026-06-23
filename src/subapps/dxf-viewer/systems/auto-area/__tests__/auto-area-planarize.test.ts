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

describe('findClosedPolygonsFromLines — gap-bridging (HPGAPTOL, άνοιγμα πόρτας/σκάλας)', () => {
  // Δωμάτιο 3000×3000 με ΑΝΟΙΓΜΑ 650 στο κάτω όριο (y=0) μεταξύ x=1175 και x=1825,
  // ευθυγραμμισμένο — όπως το πραγματικό δωμάτιο «8» (άνοιγμα σκάλας στο y≈7400).
  const ROOM_WITH_OPENING: ReadonlyArray<readonly [Point2D, Point2D]> = [
    [{ x: 0, y: 0 }, { x: 1175, y: 0 }],       // bottom-left
    [{ x: 1825, y: 0 }, { x: 3000, y: 0 }],    // bottom-right  (κενό 1175→1825 = 650)
    [{ x: 3000, y: 0 }, { x: 3000, y: 3000 }], // right
    [{ x: 3000, y: 3000 }, { x: 0, y: 3000 }], // top
    [{ x: 0, y: 3000 }, { x: 0, y: 0 }],       // left
  ];

  const hasRoom = (faces: Point2D[][]): boolean =>
    faces.some((f) => Math.abs(polyArea(f) - 3000 * 3000) < 1);

  it('gapTol=0 → ΔΕΝ κλείνει το ανοιχτό όριο (καμία περιοχή δωματίου)', () => {
    const faces = findClosedPolygonsFromLines(ROOM_WITH_OPENING, 6, 0);
    expect(hasRoom(faces)).toBe(false);
  });

  it('gapTol ≥ άνοιγμα → «extend-to-gap» γέφυρα κλείνει το δωμάτιο', () => {
    const faces = findClosedPolygonsFromLines(ROOM_WITH_OPENING, 6, 700);
    expect(hasRoom(faces)).toBe(true);
  });

  it('mergeTol ΔΕΝ διογκώνεται: μικρό gapTol < άνοιγμα → παραμένει ανοιχτό', () => {
    const faces = findClosedPolygonsFromLines(ROOM_WITH_OPENING, 6, 100);
    expect(hasRoom(faces)).toBe(false);
  });
});

describe('findClosedPolygonsFromLines — dedup διπλών/επικαλυπτόμενων ακμών', () => {
  it('τοίχοι σχεδιασμένοι δύο φορές (διπλές γραμμές) ΔΕΝ χαλούν την ανίχνευση', () => {
    // Τετράγωνο 1000×1000 με ΚΑΘΕ πλευρά διπλή (όπως line_510-513 ≡ line_554-557).
    const base: ReadonlyArray<readonly [Point2D, Point2D]> = [
      [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
      [{ x: 1000, y: 0 }, { x: 1000, y: 1000 }],
      [{ x: 1000, y: 1000 }, { x: 0, y: 1000 }],
      [{ x: 0, y: 1000 }, { x: 0, y: 0 }],
    ];
    const doubled = [...base, ...base];
    const faces = findClosedPolygonsFromLines(doubled, 0.001);
    // Ακριβώς ΜΙΑ φραγμένη όψη 1000×1000 (όχι σπασμένη/διπλή).
    const rooms = faces.filter((f) => Math.abs(polyArea(f) - 1_000_000) < 1e-6);
    expect(rooms).toHaveLength(1);
  });
});

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

describe('getAutoAreaHitResult — ΠΡΑΓΜΑΤΙΚΟ δωμάτιο «8» (από Firestore scene.json)', () => {
  // Τα πραγματικά entities γύρω από τον χώρο «8» (lvl_0d347bab…, scale 0.14076, mm).
  // Περιλαμβάνει: άνοιγμα σκάλας 650 στο y=7400, διπλές γραμμές (510-513≡554-557),
  // και το τόξο σκάλας (arc_1102, r=701.8, 274°). Συντεταγμένες στρογγυλεμένες σε mm.
  const ROOM8: Entity[] = [
    line('87', 10051, 7300, 8201, 7300), line('88', 8201, 7300, 8201, 7400),
    line('89', 8201, 7400, 10051, 7400), line('90', 10051, 7400, 10051, 7300),
    line('343', 10251, 11000, 7201, 11000), line('344', 7201, 11000, 7201, 11250),
    line('345', 7201, 11250, 10251, 11250), line('346', 10251, 11250, 10251, 11000),
    line('350', 6951, 7400, 6951, 7300),
    line('510', 7201, 11250, 7201, 10750), line('511', 7201, 11250, 6951, 11250),
    line('512', 6951, 10750, 7201, 10750), line('513', 6951, 10750, 6951, 11250),
    line('514', 7051, 10750, 7051, 8300), line('515', 7051, 8300, 6951, 8300),
    line('516', 6951, 8300, 6951, 10750), line('517', 6951, 10750, 7051, 10750),
    line('521', 6951, 11250, 6951, 11000),
    line('554', 7201, 11250, 7201, 10750), line('555', 7201, 11250, 6951, 11250),
    line('556', 6951, 10750, 7201, 10750), line('557', 6951, 10750, 6951, 11250),
    line('590', 10251, 11000, 10251, 7300), line('591', 10251, 7300, 10051, 7300),
    line('592', 10051, 7300, 10051, 11000), line('593', 10051, 11000, 10251, 11000),
    line('597', 10051, 7300, 10251, 7300),
    line('700', 7201, 7300, 6951, 7300), line('701', 7201, 7300, 7201, 8300),
    line('702', 6951, 8300, 6951, 7300), line('703', 6951, 8300, 7201, 8300),
    line('704', 7201, 7400, 7251, 7400), line('705', 7251, 7400, 7251, 7300),
    line('706', 7251, 7300, 7201, 7300), line('707', 7201, 7300, 7201, 7400),
    line('708', 8051, 7400, 8201, 7400), line('709', 8201, 7400, 8201, 7300),
    line('710', 8201, 7300, 8051, 7300), line('711', 8051, 7300, 8051, 7400),
    line('717', 8101, 7300, 8201, 7300),
    line('1103', 7301, 7400, 7301, 8100), line('1104', 7301, 7400, 7351, 7400),
    line('1105', 7351, 7400, 7351, 8100), line('1106', 7301, 8100, 7351, 8100),
    line('1107', 7301, 7400, 7301, 7350), line('1108', 7301, 7350, 7251, 7350),
    line('1109', 7251, 7350, 7251, 7400), line('1110', 7251, 7400, 7301, 7400),
    line('1111', 8001, 7400, 8001, 7350), line('1112', 8001, 7350, 8051, 7350),
    line('1113', 8051, 7350, 8051, 7400), line('1114', 8051, 7400, 8001, 7400),
    arc('1102', 7301, 7400, 701.78, 0, -274.086),
  ];
  const CENTER: Point2D = { x: 8500, y: 9000 }; // καθαρό εσωτερικό του δωματίου

  it('εντοπίζει τον ΚΑΘΑΡΟ χώρο (v3 noding + v4 curves + dedup) — όχι ολόκληρο το σχέδιο', () => {
    // Με gapTol=0: οι τοίχοι της σκάλας (1103-1114) δίνουν συνδεσιμότητα γύρω από το
    // άνοιγμα → ο half-edge traversal κλείνει το δωμάτιο. Καθαρό ≈ 3000×3600 mm.
    const hit = getAutoAreaHitResult(CENTER, ROOM8, [], 0.14076, 0);
    expect(hit).not.toBeNull();
    const area = polyArea(hit!.polygon);
    expect(area).toBeGreaterThan(5_000_000);
    expect(area).toBeLessThan(15_000_000); // ΟΧΙ ολόκληρο το σχέδιο (~115M)
  });

  it('gap-bridging (gapTol≥άνοιγμα) δεν χαλά τον εντοπισμό', () => {
    const hit = getAutoAreaHitResult(CENTER, ROOM8, [], 0.14076, 800);
    expect(hit).not.toBeNull();
    const area = polyArea(hit!.polygon);
    expect(area).toBeGreaterThan(5_000_000);
    expect(area).toBeLessThan(15_000_000);
  });

  it('εντοπίζει την καφέ κολώνα «1» (μικρό ορθογώνιο — collinear-overlap dedup)', () => {
    // Κλικ μέσα στην κολώνα 700-703 (x[6951,7201] y[7300,8300]). Πριν το dedup, η
    // γραμμή 703 (πάνω από 515) δημιουργούσε διπλές half-edges → χαλούσε η όψη.
    const hit = getAutoAreaHitResult({ x: 7075, y: 7800 }, ROOM8, [], 0.14076, 0);
    expect(hit).not.toBeNull();
    const area = polyArea(hit!.polygon);
    expect(area).toBeGreaterThan(150_000);
    expect(area).toBeLessThan(400_000); // ≈250k mm² (κολώνα), ΟΧΙ το δωμάτιο
  });

  it('κολώνα «1» ανιχνεύεται ΑΝΕΞΑΡΤΗΤΑ ΑΠΟ ΤΟ ZOOM (mergeTol cap — όχι node-collapse)', () => {
    // Πριν το cap: σε χαμηλό zoom (scale≤0.02) το mergeTol=6/scale ξεπερνούσε τα
    // 250mm → οι 2 παρειές της κολώνας συγχωνεύονταν → επέστρεφε το δωμάτιο/NULL.
    for (const scale of [0.14076, 0.05, 0.02, 0.01, 0.005]) {
      const hit = getAutoAreaHitResult({ x: 7075, y: 7800 }, ROOM8, [], scale, 0);
      expect(hit).not.toBeNull();
      const area = polyArea(hit!.polygon);
      expect(area).toBeGreaterThan(150_000);
      expect(area).toBeLessThan(400_000);
    }
  });
});

describe('getAutoAreaHitResult — κολώνα «1» με ΑΚΡΙΒΗ noisy coords (near-collinear overlaps)', () => {
  // Πραγματικά entities από Firestore (κουτί x[6951,7201] y[10750,11250]): ΚΑΘΕ ακμή
  // διπλή (510≡554…) + 3 μερικώς-επικαλυπτόμενες (344/517/521). Οι συντεταγμένες έχουν
  // float-noise ~1e-8 → το determinant-based segmentIntersection (eps 1e-9) ταξινομεί
  // λάθος τις σχεδόν-συγγραμμικές ως «τομή». Πριν το fix → NULL· τώρα → 125k mm².
  const ln = (id: string, a: number, b: number, c: number, d: number): Entity =>
    ({ id, type: 'line', start: { x: a, y: b }, end: { x: c, y: d } } as unknown as Entity);
  const COLUMN1: Entity[] = [
    ln('line_344', 7201.387818866133, 10999.999999999645, 7201.387818866126, 11249.999999999645),
    ln('line_510', 7201.387818866127, 11249.999999999704, 7201.387818866126, 10749.999999999704),
    ln('line_511', 7201.387818866127, 11249.999999999704, 6951.387818866127, 11249.999999999705),
    ln('line_512', 6951.387818866126, 10749.999999999705, 7201.387818866126, 10749.999999999704),
    ln('line_513', 6951.387818866126, 10749.999999999705, 6951.387818866127, 11249.999999999705),
    ln('line_517', 6951.387818866124, 10749.999999999705, 7051.387818866124, 10749.999999999704),
    ln('line_521', 6951.387818866126, 11249.999999999904, 6951.387818866118, 10999.999999999904),
    ln('line_554', 7201.387818866126, 11249.999999999704, 7201.387818866124, 10749.999999999704),
    ln('line_555', 7201.387818866126, 11249.999999999704, 6951.387818866126, 11249.999999999705),
    ln('line_556', 6951.387818866124, 10749.999999999705, 7201.387818866124, 10749.999999999704),
    ln('line_557', 6951.387818866124, 10749.999999999705, 6951.387818866126, 11249.999999999705),
  ];

  it('ανιχνεύεται σε κάθε zoom (always-run endpoint-split για near-collinear overlaps)', () => {
    for (const scale of [0.14076, 0.05, 0.02, 0.01]) {
      const hit = getAutoAreaHitResult({ x: 7075, y: 11000 }, COLUMN1, [], scale, 0);
      expect(hit).not.toBeNull();
      const area = polyArea(hit!.polygon);
      expect(area).toBeGreaterThan(80_000); // ≈125k mm² (250×500)
      expect(area).toBeLessThan(200_000);
    }
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
