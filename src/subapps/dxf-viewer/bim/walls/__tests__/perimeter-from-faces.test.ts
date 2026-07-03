/**
 * ADR-363 — «Δομικά στοιχεία από περίγραμμα» perimeter-from-faces SSoT (Φάση 0) tests.
 *
 * Covers: shape classification (rectangle / L / T / U / composite), rectilinear
 * slab decomposition (area-preserving leg rects, rotated frames), closed-polygon
 * extraction (closed polyline / rectangle entity / loose-line loop), and the
 * mixed-selection orchestrator (valid perimeters built, garbage → ignoredCount).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LineEntity, LWPolylineEntity } from '../../../types/entities';
import {
  classifyPerimeter,
  decomposeRectilinear,
  extractClosedPolygons,
  perimeterFacesToRects,
  pickSmallestContainingPerimeter,
  isPerimeterOversized,
  perimeterMemberThicknessMm,
  perimeterExtentMm,
  findOpenChainLineIdsNear,
  findOpenChainEndpointsNear,
} from '../perimeter-from-faces';

const TOL = 5;

/** Σωρευτικό εμβαδόν σκελών (για έλεγχο area-preservation). */
function sumArea(rects: ReadonlyArray<{ area: number }>): number {
  return rects.reduce((s, r) => s + r.area, 0);
}

// Rectangle 5000×300 (CCW).
const RECT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 300 },
  { x: 0, y: 300 },
];

// L (Γ): stem x[0,300] y[0,3000] + foot x[0,3000] y[0,300]. Area = 1,710,000.
const L_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 }, // reflex
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// U (Π): foot y[0,300] x[0,3000] + two stems x[0,300] & x[2700,3000] up to y=3000.
const U_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 3000 },
  { x: 2700, y: 3000 },
  { x: 2700, y: 300 }, // reflex
  { x: 300, y: 300 }, // reflex
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// T (Τ): stem x[1350,1650] y[0,2700] + bar x[0,3000] y[2700,3000].
const T_SHAPE: Point2D[] = [
  { x: 1350, y: 0 },
  { x: 1650, y: 0 },
  { x: 1650, y: 2700 }, // reflex
  { x: 3000, y: 2700 },
  { x: 3000, y: 3000 },
  { x: 0, y: 3000 },
  { x: 0, y: 2700 },
  { x: 1350, y: 2700 }, // reflex
];

/** Στρέφει πολύγωνο κατά `ang` (rad) γύρω από το (0,0). */
function rotatePoly(poly: readonly Point2D[], ang: number): Point2D[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return poly.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

describe('perimeter-from-faces — classifyPerimeter', () => {
  it('classifies a rectangle', () => {
    expect(classifyPerimeter(RECT, TOL)).toBe('rectangle');
  });

  it('classifies an L (Γ) — 6 verts, 1 reflex', () => {
    expect(classifyPerimeter(L_SHAPE, TOL)).toBe('L');
  });

  it('classifies a U (Π) — 8 verts, 2 adjacent reflex', () => {
    expect(classifyPerimeter(U_SHAPE, TOL)).toBe('U');
  });

  it('classifies a T (Τ) — 8 verts, 2 stem-separated reflex', () => {
    expect(classifyPerimeter(T_SHAPE, TOL)).toBe('T');
  });

  it('is orientation-independent (classifies a clockwise L the same)', () => {
    expect(classifyPerimeter([...L_SHAPE].reverse(), TOL)).toBe('L');
  });

  it('drops collinear midpoints before counting (rectangle with a split edge)', () => {
    const withMid: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2500, y: 0 }, // collinear midpoint on the bottom edge
      { x: 5000, y: 0 },
      { x: 5000, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(classifyPerimeter(withMid, TOL)).toBe('rectangle');
  });

  it('classifies a non-rectilinear shape (triangle) as composite', () => {
    const tri: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 1500, y: 2000 },
    ];
    expect(classifyPerimeter(tri, TOL)).toBe('composite');
  });

  it('classifies a parallelogram (no right angles) as composite', () => {
    const para: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 1000, y: 3000 },
    ];
    expect(classifyPerimeter(para, TOL)).toBe('composite');
  });
});

describe('perimeter-from-faces — decomposeRectilinear', () => {
  it('returns one rect for a rectangle (length = long side, thickness = short)', () => {
    const rects = decomposeRectilinear(RECT, TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].longSide).toBeCloseTo(5000, 3);
    expect(rects[0].shortSide).toBeCloseTo(300, 3);
  });

  it('splits an L into 2 area-preserving leg rects', () => {
    const rects = decomposeRectilinear(L_SHAPE, TOL);
    expect(rects).toHaveLength(2);
    expect(sumArea(rects)).toBeCloseTo(1_710_000, 0);
    // each leg thickness = 300 (the short side)
    for (const r of rects) expect(r.shortSide).toBeCloseTo(300, 3);
  });

  it('splits a U into 3 area-preserving leg rects', () => {
    const rects = decomposeRectilinear(U_SHAPE, TOL);
    expect(rects).toHaveLength(3);
    // foot (3000×300) + 2 stems (300×2700) = 900k + 2×810k = 2,520,000
    expect(sumArea(rects)).toBeCloseTo(2_520_000, 0);
  });

  it('decomposes a rotated L identically (rect count + total area invariant)', () => {
    const rotated = rotatePoly(L_SHAPE, Math.PI / 5); // 36°
    const rects = decomposeRectilinear(rotated, TOL);
    expect(rects).toHaveLength(2);
    expect(sumArea(rects)).toBeCloseTo(1_710_000, -1);
  });

  it('returns [] for a non-rectilinear (composite) shape', () => {
    const tri: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 1500, y: 2000 },
    ];
    expect(decomposeRectilinear(tri, TOL)).toHaveLength(0);
  });
});

// ─── Entity extraction ───────────────────────────────────────────────────────

function lwPolyline(id: string, verts: Point2D[], closed: boolean): LWPolylineEntity {
  return { id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed } as LWPolylineEntity;
}

function lineEntity(id: string, s: Point2D, e: Point2D): LineEntity {
  return { id, type: 'line', layerId: 'lyr', start: s, end: e };
}

describe('perimeter-from-faces — extractClosedPolygons', () => {
  it('reads a closed lwpolyline directly', () => {
    const polys = extractClosedPolygons([lwPolyline('p', L_SHAPE, true)], TOL);
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(6);
  });

  it('ignores an OPEN polyline (not a perimeter)', () => {
    expect(extractClosedPolygons([lwPolyline('p', L_SHAPE, false)], TOL)).toHaveLength(0);
  });

  it('chains loose lines into one loop (L from 6 segments)', () => {
    const segs: Entity[] = L_SHAPE.map((v, i) =>
      lineEntity(`s${i}`, v, L_SHAPE[(i + 1) % L_SHAPE.length]),
    );
    const polys = extractClosedPolygons(segs, TOL);
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(6);
  });
});

describe('perimeter-from-faces — perimeterFacesToRects (orchestrator)', () => {
  it('builds rects for a valid L perimeter', () => {
    const res = perimeterFacesToRects([lwPolyline('p', L_SHAPE, true)], TOL);
    expect(res.perimeters).toHaveLength(1);
    expect(res.perimeters[0].shape).toBe('L');
    expect(res.rects).toHaveLength(2);
    expect(res.ignoredCount).toBe(0);
  });

  it('mixed selection: builds valid + counts garbage as ignored', () => {
    const triangle: Point2D[] = [
      { x: 10000, y: 0 },
      { x: 13000, y: 0 },
      { x: 11500, y: 2000 },
    ];
    const res = perimeterFacesToRects(
      [lwPolyline('good', L_SHAPE, true), lwPolyline('bad', triangle, true)],
      TOL,
    );
    expect(res.rects).toHaveLength(2); // only the L
    expect(res.ignoredCount).toBe(1); // the triangle
  });
});

// ─── ADR-363 Phase 3b fix — two touching rectangles drawn as LOOSE LINES ──────
// ADR-419 §planar-faces: a Γ/L pier drawn as a foot + a stem rectangle whose lines
// SHARE a corner. The shared corner becomes a degree-4 / T-junction graph node. The OLD
// strict simple-cycle walker traced NO loop and "Τοιχίο από περίγραμμα" emitted
// "noneBuilt". The NEW half-edge planar detector (`findClosedPolygonsFromLines`) handles
// junctions of ANY degree, so both faces are found directly; `unionTouching` merges the L.

// Foot A: x[300,3000] y[0,300]. Stem B: x[0,300] y[0,3000]. Share corner (300,0).
const RECT_A_FOOT: Point2D[] = [
  { x: 300, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 },
];
const RECT_B_STEM: Point2D[] = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

/** Ένα ορθογώνιο ως 4 ανεξάρτητες (loose) γραμμές. */
function looseRectLines(id: string, rect: readonly Point2D[]): Entity[] {
  return rect.map((v, i) => lineEntity(`${id}${i}`, v, rect[(i + 1) % rect.length]));
}

describe('perimeter-from-faces — touching loose-line rectangles (ADR-419 planar faces)', () => {
  const touchingLoose: Entity[] = [
    ...looseRectLines('a', RECT_A_FOOT),
    ...looseRectLines('b', RECT_B_STEM),
  ];

  it('planar face traversal finds BOTH touching rects (shared-corner junction)', () => {
    // Old degree-2-only walker missed these; the planar detector handles junctions.
    expect(extractClosedPolygons(touchingLoose, TOL)).toHaveLength(2);
  });

  it('does NOT double-count a single clean rectangle', () => {
    expect(extractClosedPolygons(looseRectLines('a', RECT_A_FOOT), TOL)).toHaveLength(1);
  });

  it('perimeterFacesToRects + unionTouching merges them into ONE L (Γ)', () => {
    const res = perimeterFacesToRects(touchingLoose, TOL, { unionTouching: true });
    expect(res.perimeters).toHaveLength(1);
    expect(res.perimeters[0].shape).toBe('L');
    expect(res.ignoredCount).toBe(0);
  });

  it('wall path (no unionTouching) now detects both touching rects as separate members', () => {
    // Junctions are handled → each closed face becomes its own rectangle member.
    const { perimeters } = perimeterFacesToRects(touchingLoose, TOL);
    expect(perimeters).toHaveLength(2);
    expect(perimeters.every((p) => p.shape === 'rectangle')).toBe(true);
  });
});

// ─── ADR-419 — region-pick SSoT (Layers 1/2/4/5) ──────────────────────────────

// Εμφωλευμένα ορθογώνια: εξωτερικό 6000×6000, εσωτερικό 1000×1000 (κεντραρισμένο).
const OUTER_6K: Point2D[] = [
  { x: 0, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 6000 },
  { x: 0, y: 6000 },
];
const INNER_1K: Point2D[] = [
  { x: 2500, y: 2500 },
  { x: 3500, y: 2500 },
  { x: 3500, y: 3500 },
  { x: 2500, y: 3500 },
];
// Γιγάντιο (το bug): 27000×25000 (mm). Μικρή πλευρά 25000 >> 3000.
const GIANT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 27000, y: 0 },
  { x: 27000, y: 25000 },
  { x: 0, y: 25000 },
];

describe('perimeter-from-faces — pickSmallestContainingPerimeter (Layer 1)', () => {
  const { perimeters } = perimeterFacesToRects(
    [lwPolyline('outer', OUTER_6K, true), lwPolyline('inner', INNER_1K, true)],
    TOL,
  );

  it('picks the INNERMOST (smallest-area) loop when point is inside both', () => {
    const pick = pickSmallestContainingPerimeter({ x: 3000, y: 3000 }, perimeters);
    expect(pick).not.toBeNull();
    // Το εσωτερικό 1000×1000 (scale=1 → mm).
    expect(perimeterExtentMm(pick!, 1).width).toBeCloseTo(1000, 0);
  });

  it('picks the outer loop when point is only inside the outer', () => {
    const pick = pickSmallestContainingPerimeter({ x: 500, y: 500 }, perimeters);
    expect(pick).not.toBeNull();
    expect(perimeterExtentMm(pick!, 1).width).toBeCloseTo(6000, 0);
  });

  it('returns null when point is outside every loop', () => {
    expect(pickSmallestContainingPerimeter({ x: 99999, y: 99999 }, perimeters)).toBeNull();
  });
});

describe('perimeter-from-faces — size sanity guard (Layer 4)', () => {
  const giant = perimeterFacesToRects([lwPolyline('g', GIANT, true)], TOL).perimeters[0];
  const normalCol = perimeterFacesToRects([lwPolyline('c', INNER_1K, true)], TOL).perimeters[0];
  const longThin = perimeterFacesToRects([lwPolyline('w', RECT, true)], TOL).perimeters[0]; // 5000×300

  it('flags the drawing outer outline as oversized (the bug)', () => {
    expect(isPerimeterOversized(giant, 1)).toBe(true);
    expect(perimeterMemberThicknessMm(giant, 1)).toBeCloseTo(25000, 0);
  });

  it('accepts a normal column (1000×1000)', () => {
    expect(isPerimeterOversized(normalCol, 1)).toBe(false);
  });

  it('accepts a long thin wall (5000×300) — only the SHORT side is checked', () => {
    expect(isPerimeterOversized(longThin, 1)).toBe(false);
    expect(perimeterMemberThicknessMm(longThin, 1)).toBeCloseTo(300, 0);
  });
});

// Ορθογώνιο 2000×300 ως 4 loose lines ΜΕ κενό 30mm σε μία γωνία.
const GAPPED_RECT_LINES: Entity[] = [
  lineEntity('g0', { x: 0, y: 0 }, { x: 2000, y: 0 }),
  lineEntity('g1', { x: 2000, y: 0 }, { x: 2000, y: 300 }),
  lineEntity('g2', { x: 2000, y: 300 }, { x: 0, y: 300 }),
  lineEntity('g3', { x: 0, y: 300 }, { x: 0, y: 30 }), // κενό 30 ανάμεσα (0,30)→(0,0)
];

describe('perimeter-from-faces — gap-tolerant closure (Layer 2)', () => {
  it('does NOT close the loop with a tight tolerance (gap 30 > tol 5)', () => {
    expect(perimeterFacesToRects(GAPPED_RECT_LINES, 5).perimeters).toHaveLength(0);
  });

  it('closes the loop with a gap-tolerant tolerance (tol 50 ≥ gap 30)', () => {
    expect(perimeterFacesToRects(GAPPED_RECT_LINES, 50).perimeters).toHaveLength(1);
  });
});

describe('perimeter-from-faces — open-loop diagnostics (Layer 5)', () => {
  it('returns the line ids with open endpoints near the pick', () => {
    const ids = findOpenChainLineIdsNear({ x: 0, y: 15 }, GAPPED_RECT_LINES, 5);
    expect(ids.sort()).toEqual(['g0', 'g3']); // οι γραμμές της ασύνδετης γωνίας
  });

  it('returns nothing when there are no open endpoints near (clean closed rect)', () => {
    const clean = looseRectLines('c', RECT_A_FOOT);
    expect(findOpenChainLineIdsNear({ x: 1500, y: 150 }, clean, 5)).toHaveLength(0);
  });

  // ADR-419 Layer 5b — τα ΣΗΜΕΙΑ των ανοιχτών άκρων (AutoCAD BOUNDARY gap markers).
  it('returns the open ENDPOINT POINTS near the pick (gap markers)', () => {
    const pts = findOpenChainEndpointsNear({ x: 0, y: 15 }, GAPPED_RECT_LINES, 5);
    expect(pts).toHaveLength(2);
    const rounded = pts
      .map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
      .sort((a, b) => a.y - b.y);
    expect(rounded).toEqual([{ x: 0, y: 0 }, { x: 0, y: 30 }]); // τα δύο ελεύθερα άκρα της γωνίας
  });

  it('returns no endpoint points for a clean closed rect', () => {
    const clean = looseRectLines('c', RECT_A_FOOT);
    expect(findOpenChainEndpointsNear({ x: 1500, y: 150 }, clean, 5)).toHaveLength(0);
  });
});

// ADR-419 §thickness-zones — ένας τοίχος = ΕΝΑ πάχος. Ένα σύνθετο (rectilinear)
// περίγραμμα με αλλαγή πάχους σπάει σε σκέλη σταθερού πλάτους (ένας τοίχος ανά σκέλος)·
// το κοινό junction το παίρνει ο κύριος/συνεχής (μακρύτερος) τοίχος.
describe('perimeter-from-faces — thickness-zones split', () => {
  // Έκεντρο-Τ: οριζόντιος τοίχος (μήκος 2700, πάχος 200) + κατακόρυφη μύτη
  // (πλάτος 450, εκτείνεται 400 κάτω), έκεντρα στο x∈[1000,1450].
  const OFFSET_T: Point2D[] = [
    { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -400 }, { x: 1450, y: -400 },
    { x: 1450, y: 0 }, { x: 2700, y: 0 }, { x: 2700, y: 200 }, { x: 0, y: 200 },
  ];
  // Διπλή μύτη διαφορετικού πάχους (12 κορυφές → shape 'composite', πρώην αγνοείτο).
  const TWO_STUBS: Point2D[] = [
    { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: -400 }, { x: 800, y: -400 },
    { x: 800, y: 0 }, { x: 1800, y: 0 }, { x: 1800, y: -600 }, { x: 2400, y: -600 },
    { x: 2400, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 200 }, { x: 0, y: 200 },
  ];

  it('έκεντρο-Τ (2 πάχη) → 2 σκέλη σταθερού πλάτους (junction στον κύριο)', () => {
    const { rects } = perimeterFacesToRects(looseRectLines('t', OFFSET_T), TOL);
    expect(rects).toHaveLength(2);
    const shorts = rects.map((r) => Math.round(r.shortSide)).sort((a, b) => a - b);
    expect(shorts).toEqual([200, 400]); // δύο διαφορετικά πάχη, ΟΧΙ ένας ενιαίος τοίχος
    // ο κύριος (οριζόντιος) παίρνει ΟΛΟ το μήκος 2700 — συμπεριλαμβανομένου του junction.
    const longest = Math.max(...rects.map((r) => Math.round(r.longSide)));
    expect(longest).toBe(2700);
  });

  it('πολυζωνικό >8 κορυφές (πρώην composite→αγνοείτο) → σπάει σε 3 σκέλη, τίποτα ignored', () => {
    const { rects, ignoredCount } = perimeterFacesToRects(looseRectLines('s', TWO_STUBS), TOL);
    expect(rects).toHaveLength(3);
    expect(ignoredCount).toBe(0);
    // τρία διακριτά πάχη: ο οριζόντιος (200) + οι δύο μύτες (300, 600).
    const shorts = rects.map((r) => Math.round(r.shortSide)).sort((a, b) => a - b);
    expect(shorts).toEqual([200, 300, 600]);
  });

  it('απλό ορθογώνιο → ΕΝΑ σκέλος (μηδέν regression για ομοιόμορφο πάχος)', () => {
    const { rects } = perimeterFacesToRects(looseRectLines('r', RECT_A_FOOT), TOL);
    expect(rects).toHaveLength(1);
  });
});

// ADR-419 §planar-faces — το πραγματικό use-case: exploded αρχιτεκτονική κάτοψη με
// γραμμές που τέμνονται (junctions βαθμού >2) ΚΑΙ μη-ορθές (αμβλείες) γωνίες. Ο παλιός
// simple-cycle walker τα έχανε ΟΛΑ· ο planar detector τα πιάνει.
describe('perimeter-from-faces — planar faces: junctions + αμβλείες γωνίες', () => {
  // «Γ» με ΚΕΚΛΙΜΕΝΟ κάθετο σκέλος (αμβλεία γωνία, μη-κάθετα σκέλη) ως loose lines.
  const OBTUSE_L: Point2D[] = [
    { x: 0, y: 0 },
    { x: 3000, y: 0 },
    { x: 3000, y: 300 },
    { x: 800, y: 300 },
    { x: 300, y: 3000 },
    { x: 0, y: 3000 },
  ];

  it('αμβλεία γωνία «Γ» ως loose lines → ΕΝΑ composite περίγραμμα (rect detector θα το έχανε)', () => {
    const { perimeters } = perimeterFacesToRects(looseRectLines('o', OBTUSE_L), TOL);
    expect(perimeters).toHaveLength(1);
    const pick = pickSmallestContainingPerimeter({ x: 150, y: 150 }, perimeters);
    expect(pick).not.toBeNull();
    expect(pick?.shape).toBe('composite');
  });

  it('junction βαθμού 3 (δωμάτιο χωρισμένο στη μέση) → click βρίσκει το ΕΛΑΧΙΣΤΟ μισό', () => {
    // Ορθογώνιο 2000×1000 + εσωτερική διαχωριστική γραμμή x=1000 → T-junctions βαθμού 3.
    const room = looseRectLines('r', [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 1000 },
      { x: 0, y: 1000 },
    ]);
    const divider = lineEntity('d', { x: 1000, y: 0 }, { x: 1000, y: 1000 });
    const { perimeters } = perimeterFacesToRects([...room, divider], TOL);
    expect(perimeters).toHaveLength(2); // δύο μισά — ο παλιός walker έβγαζε 0
    const left = pickSmallestContainingPerimeter({ x: 500, y: 500 }, perimeters);
    expect(left).not.toBeNull();
    expect(Math.round(polygonAreaAbs(left!.polygon))).toBe(1_000_000); // 1000×1000
  });
});

/** |shoelace|/2 — απόλυτο εμβαδόν (ανεξάρτητο winding) για test assertions. */
function polygonAreaAbs(poly: readonly Point2D[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}
