/**
 * ADR-419 v2.4 — «Μία διαδρομή δημιουργίας» (preview ≡ commit 100%) tests.
 *
 * Ο `computeFillingWalls` είναι ΕΝΑ SSoT build (validate + extend + ADR-567 no-overlap)
 * που καλούν ΚΑΙ ο commit (`use-wall-commit.buildFillingWalls`) ΚΑΙ το preview
 * (`resolvePerimeterPreview`). Ό,τι φωτίζεται πράσινο = ΑΚΡΙΒΩΣ οι τοίχοι που θα χτιστούν·
 * ό,τι απορρίπτεται → κόκκινο + φιλικός λόγος (i18n key) για tooltip (Giorgio: επιλογή Α).
 *
 * Καλύπτει: (1) build parity με τον commit block (`buildWallFillingRect`), (2) rejected
 * reasons (κοντός → `lengthTooShort`, χοντρός → `thicknessTooThick`), (3) transient miter
 * footprints (`computeFillingWallFootprints`, 1:1 με τους τοίχους, μηδέν mutation).
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import { multiPolygonArea } from '../../geometry/shared/polygon-utils';
import { safeIntersection } from '../../geometry/shared/safe-polygon-boolean';
import type { WallEntity } from '../../types/wall-types';
import {
  computeFillingWalls,
  computeFillingWallFootprints,
} from '../filling-walls-compute';
import {
  findRectanglesFromSegments,
  buildWallFillingRect,
  type DetectedRectangle,
  type RegionLineSeg,
} from '../wall-in-region';

const SU = 'mm' as const;
const LEVEL = '0';
const TOL = 5;

/** 4 segments of an axis-aligned rectangle (corners CCW), edge order shuffled +
 *  some endpoints reversed to prove orientation-independence. */
function rectSegments(w: number, h: number): RegionLineSeg[] {
  return [
    { start: { x: 0, y: 0 }, end: { x: w, y: 0 } }, // bottom
    { start: { x: w, y: h }, end: { x: w, y: 0 } }, // right (reversed)
    { start: { x: 0, y: h }, end: { x: w, y: h } }, // top
    { start: { x: 0, y: 0 }, end: { x: 0, y: h } }, // left
  ];
}

/** Translate a set of segments by (dx,dy) — για δεύτερο, μη-γειτονικό δωμάτιο. */
function offset(segs: RegionLineSeg[], dx: number, dy: number): RegionLineSeg[] {
  return segs.map((s) => ({
    start: { x: s.start.x + dx, y: s.start.y + dy },
    end: { x: s.end.x + dx, y: s.end.y + dy },
  }));
}

/** Άξονο-ευθυγραμμισμένο κουτί (κάτω-αριστερή γωνία + διαστάσεις). */
const BOX = (x: number, y: number, w: number, h: number): Point2D[] =>
  [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

/** Ελάχιστη κολώνα: μόνο το αποτύπωμα (ό,τι διαβάζουν οι ενώσεις, ο κριτής και το κόψιμο σώματος). */
function columnBox(id: string, x: number, y: number, w: number, h: number): Entity {
  const vertices = BOX(x, y, w, h).map((p) => ({ ...p, z: 0 }));
  return { id, type: 'column', geometry: { footprint: { vertices } } } as unknown as Entity;
}

const toClip = (pieces: readonly Point2D[][]): Polygon[] => pieces.map((p): Polygon => [p.map((v): Pair => [v.x, v.y])]);
const litArea = (bodies: readonly Point2D[][][]): number =>
  bodies.reduce((sum, pieces) => sum + pieces.reduce((s, p) => s + multiPolygonArea(toClip([p])), 0), 0);
const pairOverlap = (a: readonly Point2D[][], b: readonly Point2D[][]): number =>
  multiPolygonArea(safeIntersection(toClip(a), toClip(b)));

describe('computeFillingWalls — build parity με τον commit', () => {
  it('builds one filling wall from a thin rectangle (thickness = short, axis = long)', () => {
    const rects = findRectanglesFromSegments(rectSegments(5000, 250), TOL);
    const { walls, rejected } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(1);
    expect(rejected).toHaveLength(0);
    const w = walls[0];
    expect(w.type).toBe('wall');
    expect(w.params.thickness).toBeCloseTo(250, 3);
    // Χωρίς γείτονες, το extend δεν αλλάζει τον άξονα → μήκος = μεγάλη πλευρά.
    const axisLen = Math.hypot(w.params.end.x - w.params.start.x, w.params.end.y - w.params.start.y);
    expect(axisLen).toBeCloseTo(5000, 3);
  });

  it('παράγει ΙΔΙΟ τοίχο (πάχος) με τον commit build block (buildWallFillingRect)', () => {
    // Ο commit καλεί computeFillingWalls → buildWallFillingRectResult· ο buildWallFillingRect
    // είναι ο ίδιος build block (null wrapper). Preview ≡ commit εξ ορισμού.
    const rects = findRectanglesFromSegments(rectSegments(4000, 300), TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    const direct = buildWallFillingRect(rects[0], {}, SU, LEVEL);
    expect(direct).not.toBeNull();
    expect(walls[0].params.thickness).toBeCloseTo((direct as WallEntity).params.thickness, 3);
  });

  it('builds one wall per detected rectangle (δύο δωμάτια → δύο τοίχοι)', () => {
    const two = [...rectSegments(4000, 250), ...offset(rectSegments(4000, 250), 0, 6000)];
    const rects = findRectanglesFromSegments(two, TOL);
    expect(rects).toHaveLength(2);
    const { walls, rejected } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it('returns empty result for no rectangles', () => {
    expect(computeFillingWalls([], {}, SU, LEVEL, [])).toEqual({ walls: [], rejected: [] });
  });
});

describe('computeFillingWalls — rejected reasons (κόκκινο + tooltip)', () => {
  it('rejects a too-thick rect → reason regionPerimeter.rejected.thicknessTooThick', () => {
    // 5000×3000 δωμάτιο → 3 m «πάχος» = μη-φυσικός τοίχος → validator thicknessExceedsMax.
    const rects = findRectanglesFromSegments(rectSegments(5000, 3000), TOL);
    const { walls, rejected } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('regionPerimeter.rejected.thicknessTooThick');
    expect(rejected[0].rect).toBe(rects[0]);
  });

  it('rejects a degenerate stub (<20mm) → reason regionPerimeter.rejected.lengthTooShort', () => {
    const rects = findRectanglesFromSegments(rectSegments(15, 12), TOL);
    const { walls, rejected } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('regionPerimeter.rejected.lengthTooShort');
  });

  it('χωρίζει buildable από rejected στην ίδια παρτίδα', () => {
    const mixed = [...rectSegments(4000, 250), ...offset(rectSegments(5000, 3000), 0, 8000)];
    const rects = findRectanglesFromSegments(mixed, TOL);
    expect(rects).toHaveLength(2);
    const { walls, rejected } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('regionPerimeter.rejected.thicknessTooThick');
  });
});

// ─── ADR-911 Φ3α-3 — το αποτέλεσμα δεν εξαρτάται από τη σειρά των ορθογωνίων ──────

/** Ορθογώνιο [x,y]→[x+w,y+h] όπως το δίνει ο ανιχνευτής. */
function rect(x: number, y: number, w: number, h: number): DetectedRectangle {
  return {
    polygon: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
    longSide: Math.max(w, h),
    shortSide: Math.min(w, h),
    area: w * h,
  };
}

/** Ο τοίχος ως γεωμετρία, ανεξάρτητα από το id και τη φορά του άξονα. */
function shapeOf(w: WallEntity): string {
  const ends = [w.params.start, w.params.end]
    .map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)
    .sort();
  return `${ends.join('→')}|${w.params.thickness}`;
}

const shapesOf = (walls: readonly WallEntity[]): string[] => walls.map(shapeOf).sort();

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

describe('ADR-911 Φ3α-3 — ενώσεις ανεξάρτητες από τη σειρά χτισίματος', () => {
  const through = rect(0, 0, 5000, 250); // άξονας y = 125
  const stemAbove = rect(2000, 250, 100, 1250); // ακουμπά στην πάνω παρειά
  const stemBelow = rect(3000, -1500, 100, 1500); // ακουμπά στην κάτω παρειά

  it('ο βραχίονας ενός Τ φτάνει στον άξονα του διαμπερούς ΚΑΙ όταν χτίζεται πρώτος', () => {
    // Πριν: κάθε τοίχος επεκτεινόταν μόνο προς όσους είχαν ήδη χτιστεί ⇒ με τον βραχίονα πρώτο
    // το άκρο του έμενε στην παρειά (y = 250) και οι δύο άξονες δεν συναντιόνταν.
    const stemFirst = computeFillingWalls([stemAbove, through], {}, SU, LEVEL, []);
    const throughFirst = computeFillingWalls([through, stemAbove], {}, SU, LEVEL, []);

    const stemOf = (walls: readonly WallEntity[]): WallEntity =>
      walls.find((w) => w.params.thickness === 100) as WallEntity;
    const lowEnd = (w: WallEntity): number => Math.min(w.params.start.y, w.params.end.y);

    expect(lowEnd(stemOf(stemFirst.walls))).toBeCloseTo(125, 6);
    expect(lowEnd(stemOf(throughFirst.walls))).toBeCloseTo(125, 6);
  });

  it('κάθε μετάθεση των ορθογωνίων δίνει τους ΙΔΙΟΥΣ τοίχους', () => {
    const reference = shapesOf(computeFillingWalls([through, stemAbove, stemBelow], {}, SU, LEVEL, []).walls);
    expect(reference).toHaveLength(3);
    for (const order of permutations([through, stemAbove, stemBelow])) {
      const { walls, rejected } = computeFillingWalls(order, {}, SU, LEVEL, []);
      expect(rejected).toEqual([]);
      expect(shapesOf(walls)).toEqual(reference);
    }
  });

  it('οι τοίχοι επιστρέφονται στη σειρά των ορθογωνίων (η αντιστοίχιση με δείκτη κρατά)', () => {
    const { walls } = computeFillingWalls([stemAbove, through, stemBelow], {}, SU, LEVEL, []);
    expect(walls.map((w) => w.params.thickness)).toEqual([100, 250, 100]);
    expect(Math.abs(walls[0].params.start.x - 2050)).toBeLessThan(1e-6);
    expect(Math.abs(walls[2].params.start.x - 3050)).toBeLessThan(1e-6);
  });

  it('δύο υποψήφιοι στον ίδιο χώρο: κερδίζει ο ΜΑΚΡΥΤΕΡΟΣ, όποια κι αν είναι η σειρά', () => {
    // Πριν: «όποιος μπήκε πρώτος» — με τον κοντό πρώτο χτιζόταν ο κοντός και κοβόταν ο μακρύς.
    const long = rect(0, 0, 4000, 250);
    const short = rect(500, 0, 1000, 250); // ομοαξονικός, μέσα στον μακρύ
    for (const order of [[long, short], [short, long]]) {
      const { walls, rejected } = computeFillingWalls(order, {}, SU, LEVEL, []);
      expect(walls).toHaveLength(1);
      expect(Math.hypot(walls[0].params.end.x - walls[0].params.start.x, walls[0].params.end.y - walls[0].params.start.y))
        .toBeCloseTo(4000, 6);
      expect(rejected).toEqual([{ rect: short, reason: 'regionPerimeter.rejected.occupied' }]);
    }
  });

  it('κανείς δεν μένει επεκταμένος προς τοίχο που ΔΕΝ χτίστηκε', () => {
    // Ο χοντρός υποψήφιος (άξονας y = 200) πέφτει πάνω σε υπάρχοντα τοίχο και κόβεται. Ο
    // βραχίονας θα επεκτεινόταν ως τον άξονά του· αφού εκείνος δεν χτίζεται, μένει στο y = 400.
    const thick = rect(0, 0, 5000, 400);
    const stem = rect(2000, 400, 100, 1500);
    const lowEnd = (w: WallEntity): number => Math.min(w.params.start.y, w.params.end.y);

    // Χωρίς τον υπάρχοντα τοίχο χτίζονται και οι δύο και ο βραχίονας ΕΠΕΚΤΕΙΝΕΤΑΙ (η άγκυρα δεν είναι κενή).
    const free = computeFillingWalls([stem, thick], {}, SU, LEVEL, []);
    expect(free.walls).toHaveLength(2);
    expect(lowEnd(free.walls[0])).toBeCloseTo(200, 6);

    const existing = computeFillingWalls([rect(0, 0, 5000, 250)], {}, SU, LEVEL, []).walls;
    for (const order of [[stem, thick], [thick, stem]]) {
      const { walls, rejected } = computeFillingWalls(order, {}, SU, LEVEL, existing as unknown as Entity[]);
      expect(rejected).toEqual([{ rect: thick, reason: 'regionPerimeter.rejected.occupied' }]);
      expect(walls).toHaveLength(1);
      expect(lowEnd(walls[0])).toBeCloseTo(400, 6);
    }
  });
});

describe('computeFillingWallFootprints — transient miter (μηδέν mutation)', () => {
  it('returns [] for no walls', () => {
    expect(computeFillingWallFootprints([], [])).toEqual([]);
  });

  it('ελεύθερος τοίχος: ΕΝΑ κομμάτι, το ίδιο το ορθογώνιο (1:1 με τους τοίχους)', () => {
    const rects = findRectanglesFromSegments(rectSegments(5000, 250), TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    const footprints = computeFillingWallFootprints(walls, []);
    expect(footprints).toHaveLength(walls.length);
    expect(footprints[0]).toHaveLength(1);
    expect(footprints[0][0]).toHaveLength(4);
    expect(litArea(footprints)).toBeCloseTo(5000 * 250, 3);
  });

  it('τρέχει το trim/miter pipeline για ζεύγος τοίχων → 1:1 footprints, μηδέν mutation', () => {
    const two = [...rectSegments(5000, 250), ...offset(rectSegments(250, 3000), 0, 6000)];
    const rects = findRectanglesFromSegments(two, TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(2);
    // Snapshot των αξόνων ΠΡΙΝ → το footprint compute είναι transient (δεν αγγίζει τους τοίχους).
    const before = walls.map((w) => ({ ...w.params.start }));
    const footprints = computeFillingWallFootprints(walls, []);
    expect(footprints).toHaveLength(2);
    footprints.forEach((pieces) => expect(pieces[0].length).toBeGreaterThanOrEqual(4));
    walls.forEach((w, i) => {
      expect(w.params.start.x).toBeCloseTo(before[i].x, 6);
      expect(w.params.start.y).toBeCloseTo(before[i].y, 6);
    });
  });
});

describe('computeFillingWallFootprints — φωτίζεται ό,τι ΖΩΓΡΑΦΙΖΕΤΑΙ (ADR-911 Φ3α-4)', () => {
  // Πριν: η πηγή ήταν το αποτύπωμα του σοβά (ωμό ∪ λοξοτομημένο), που αγνοεί κάθε κόψιμο. Ο
  // βραχίονας ενός Τ φωτιζόταν ως τον ΑΞΟΝΑ του διαμπερούς και το άκρο πάνω σε κολώνα ΜΕΣΑ της.

  it('Τ: ο βραχίονας φωτίζεται ως την ΠΑΡΕΙΑ του διαμπερούς — κανένα κοινό εμβαδό', () => {
    // Διαμπερής 5000×250 στο y∈[0,250]· βραχίονας 250×3000 που ακουμπά την πάνω παρειά του.
    const segs = [...rectSegments(5000, 250), ...offset(rectSegments(250, 3000), 2000, 250)];
    const rects = findRectanglesFromSegments(segs, TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(2);
    // Η ένωση ΕΓΙΝΕ: ο άξονας του βραχίονα επεκτάθηκε μέσα στον διαμπερή (αλλιώς η άγκυρα είναι κενή).
    const rawArea = walls.reduce((sum, w) =>
      sum + Math.hypot(w.params.end.x - w.params.start.x, w.params.end.y - w.params.start.y) * w.params.thickness, 0);
    expect(rawArea).toBeGreaterThan(5000 * 250 + 250 * 3000 + 1);

    const footprints = computeFillingWallFootprints(walls, []);

    expect(pairOverlap(footprints[0], footprints[1])).toBeLessThan(1);
    expect(litArea(footprints)).toBeCloseTo(5000 * 250 + 250 * 3000, 3);
  });

  it('γωνία Γ: τα δύο σκέλη φωτίζονται χωρίς διπλό τετράγωνο στη γωνία', () => {
    // Οριζόντιο 3000×250 και κατακόρυφο 250×3000 που κάθεται πάνω στο αριστερό του άκρο.
    const segs = [...rectSegments(3000, 250), ...offset(rectSegments(250, 3000), 0, 250)];
    const rects = findRectanglesFromSegments(segs, TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    expect(walls).toHaveLength(2);

    const footprints = computeFillingWallFootprints(walls, []);

    expect(pairOverlap(footprints[0], footprints[1])).toBeLessThan(1);
    expect(litArea(footprints)).toBeCloseTo(3000 * 250 + 250 * 3000, 3);
  });

  it('άκρο μέσα σε κολώνα: φωτίζεται ως την παρειά της κολώνας, όχι μέσα της', () => {
    // Κολώνα 400×400 στο x∈[0,400]· ο τοίχος ξεκινά 100 mm μέσα της.
    const col = columnBox('c', 0, -75, 400, 400);
    const rects = findRectanglesFromSegments(offset(rectSegments(3100, 250), 300, 0), TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, [col]);
    expect(walls).toHaveLength(1);

    const footprints = computeFillingWallFootprints(walls, [col]);

    expect(footprints[0]).toHaveLength(1);
    expect(litArea(footprints)).toBeCloseTo(3000 * 250, 3);
    expect(pairOverlap(footprints[0], [BOX(0, -75, 400, 400)])).toBeLessThan(1);
  });

  it('κολώνα στη μέση του τοίχου: ΔΥΟ κομμάτια εκατέρωθεν («η κολόνα νικάει»)', () => {
    const col = columnBox('c', 1500, -75, 400, 400);
    const rects = findRectanglesFromSegments(rectSegments(3400, 250), TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, [col]);
    expect(walls).toHaveLength(1);

    const footprints = computeFillingWallFootprints(walls, [col]);

    expect(footprints[0]).toHaveLength(2);
    expect(litArea(footprints)).toBeCloseTo((3400 - 400) * 250, 3);
    expect(pairOverlap(footprints[0], [BOX(1500, -75, 400, 400)])).toBeLessThan(1);
  });
});
