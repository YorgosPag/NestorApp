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

import type { Entity } from '../../../types/entities';
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

  it('returns one footprint polygon per wall (1:1, non-empty)', () => {
    const rects = findRectanglesFromSegments(rectSegments(5000, 250), TOL);
    const { walls } = computeFillingWalls(rects, {}, SU, LEVEL, []);
    const footprints = computeFillingWallFootprints(walls, []);
    expect(footprints).toHaveLength(walls.length);
    expect(footprints[0].length).toBeGreaterThanOrEqual(4);
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
    footprints.forEach((fp) => expect(fp.length).toBeGreaterThanOrEqual(4));
    walls.forEach((w, i) => {
      expect(w.params.start.x).toBeCloseTo(before[i].x, 6);
      expect(w.params.start.y).toBeCloseTo(before[i].y, 6);
    });
  });
});
