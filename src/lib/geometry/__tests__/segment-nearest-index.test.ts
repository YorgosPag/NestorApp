/**
 * ADR-920 §14.12 Β3 — το ευρετήριο πλησιέστερου τμήματος απέναντι στην εξαντλητική σάρωση: ίδια απάντηση, πάντα.
 *
 * Τα τμήματα και τα σημεία βγαίνουν από σταθερή γεννήτρια (LCG) — ίδια εκτέλεση, ίδια δεδομένα.
 */

import { distanceToSegment, segmentParameterNearest, type PlanarPoint } from '../planar-polygon';
import { createNearestSegmentSink, createSegmentNearestIndex, type PlanarSegment } from '../segment-nearest-index';

// Η ΜΙΑ προβολή πάνω σε τμήμα, αληθινή αλλά μετρημένη: πόσα τμήματα εξετάζει μια ερώτηση είναι η άγκυρα του φράγματος.
jest.mock('../planar-polygon', () => {
  const actual = jest.requireActual<typeof import('../planar-polygon')>('../planar-polygon');
  return { ...actual, segmentParameterNearest: jest.fn(actual.segmentParameterNearest) };
});

function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function randomSegments(count: number, seed: number): PlanarSegment[] {
  const next = generator(seed);
  return Array.from({ length: count }, () => {
    const a = { x: next() * 100, y: next() * 60 };
    return { a, b: { x: a.x + (next() - 0.5) * 12, y: a.y + (next() - 0.5) * 12 } };
  });
}

/** Η εξαντλητική απάντηση — ο ορισμός. */
function bruteForce(segments: readonly PlanarSegment[], point: PlanarPoint): number {
  return Math.min(...segments.map(({ a, b }) => distanceToSegment(point, a, b)));
}

describe('createSegmentNearestIndex', () => {
  const segments = randomSegments(400, 7);
  const index = createSegmentNearestIndex(segments);
  const next = generator(99);
  /** Σημεία μέσα στο πλέγμα, και έξω από αυτό προς κάθε πλευρά. */
  const points = Array.from({ length: 300 }, () => ({ x: next() * 180 - 40, y: next() * 140 - 40 }));

  it('η απόσταση είναι η μικρότερη προς κάθε τμήμα, και ο δείκτης δείχνει τμήμα που την έχει', () => {
    for (const point of points) {
      const hit = index.nearest(point.x, point.y);
      if (hit === null) throw new Error('expected a nearest segment');
      expect(hit.distance).toBeCloseTo(bruteForce(segments, point), 9);
      const { a, b } = segments[hit.segment];
      expect(distanceToSegment(point, a, b)).toBeCloseTo(hit.distance, 9);
    }
  });

  it('με όριο: ίδια απάντηση όταν το πλησιέστερο είναι μέσα σε αυτό, `null` όταν είναι πιο μακριά', () => {
    const within = 4;
    let inside = 0;
    let beyond = 0;
    for (const point of points) {
      const truth = bruteForce(segments, point);
      // Σημεία κολλητά στο όριο δεν κρίνονται.
      if (Math.abs(truth - within) < 1e-6) continue;
      const hit = index.nearest(point.x, point.y, within);
      if (truth > within) {
        beyond++;
        expect(hit).toBeNull();
      } else {
        inside++;
        expect(hit?.distance).toBeCloseTo(truth, 9);
      }
    }
    expect(inside).toBeGreaterThan(0);
    expect(beyond).toBeGreaterThan(0);
  });

  it('ένα μόνο τμήμα, και εκφυλισμένο τμήμα (σημείο)', () => {
    const one = createSegmentNearestIndex([{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }]);
    expect(one.nearest(5, 3)).toEqual({ segment: 0, distance: 3, t: 0.5 });
    expect(one.nearest(13, 4)).toEqual({ segment: 0, distance: 5, t: 1 });
    const dot = createSegmentNearestIndex([{ a: { x: 2, y: 2 }, b: { x: 2, y: 2 } }]);
    expect(dot.nearest(5, 6)).toEqual({ segment: 0, distance: 5, t: 0 });
  });

  it('κενή λίστα ⇒ καμία απάντηση, ποτέ σφάλμα', () => {
    expect(createSegmentNearestIndex([]).nearest(0, 0)).toBeNull();
    expect(createSegmentNearestIndex([]).nearestInto(createNearestSegmentSink(), 0, 0)).toBe(false);
  });

  it('το `t` δείχνει το πλησιέστερο σημείο ΠΑΝΩ στο τμήμα: από εκεί μετριέται η απόσταση', () => {
    for (const point of points) {
      const hit = index.nearest(point.x, point.y);
      if (hit === null) throw new Error('expected a nearest segment');
      const { a, b } = segments[hit.segment];
      const on = { x: a.x + hit.t * (b.x - a.x), y: a.y + hit.t * (b.y - a.y) };
      expect(Math.hypot(point.x - on.x, point.y - on.y)).toBeCloseTo(hit.distance, 9);
      expect(hit.t).toBeGreaterThanOrEqual(0);
      expect(hit.t).toBeLessThanOrEqual(1);
    }
  });

  it('`nearestInto` είναι η ίδια ερώτηση· όταν δεν υπάρχει απάντηση αφήνει το `sink` ανέγγιχτο', () => {
    const sink = createNearestSegmentSink();
    for (const point of points) {
      const hit = index.nearest(point.x, point.y, 6);
      const before = { ...sink };
      const found = index.nearestInto(sink, point.x, point.y, 6);
      expect(found).toBe(hit !== null);
      expect(sink).toEqual(hit ?? before);
    }
  });
});

/**
 * ADR-920 §14.12 Β3.1 — **το περίγραμμα**: τα τμήματα είναι το χείλος μιας αποτύπωσης (τετράγωνο 20 m, 80 ακμές) και τα
 * σημεία στέκονται ΕΞΩ από αυτό, ως 30 m μακριά — η ερώτηση της ζώνης μετάβασης, και η περίπτωση όπου η πρώτη διατύπωση
 * του φράγματος σάρωνε ολόκληρο το πλέγμα σε κάθε ερώτηση.
 */
describe('createSegmentNearestIndex — σημεία έξω από το κουτί των τμημάτων', () => {
  const SIDE = 20;
  const ring: PlanarSegment[] = [];
  for (let i = 0; i < SIDE; i++) {
    ring.push({ a: { x: i, y: 0 }, b: { x: i + 1, y: 0 } }, { a: { x: SIDE, y: i }, b: { x: SIDE, y: i + 1 } });
    ring.push({ a: { x: SIDE - i, y: SIDE }, b: { x: SIDE - i - 1, y: SIDE } }, { a: { x: 0, y: SIDE - i }, b: { x: 0, y: SIDE - i - 1 } });
  }
  const index = createSegmentNearestIndex(ring);
  const next = generator(2024);
  /** Σημεία σε πλαίσιο 30 m γύρω από το τετράγωνο (και μέσα σε αυτό). */
  const around = Array.from({ length: 600 }, () => ({ x: next() * 80 - 30, y: next() * 80 - 30 }));

  it('ίδια απάντηση με την εξαντλητική σάρωση, με και χωρίς όριο', () => {
    const within = 30;
    for (const point of around) {
      const truth = bruteForce(ring, point);
      expect(index.nearest(point.x, point.y)?.distance).toBeCloseTo(truth, 9);
      if (Math.abs(truth - within) < 1e-6) continue;
      const hit = index.nearest(point.x, point.y, within);
      if (truth > within) expect(hit).toBeNull();
      else expect(hit?.distance).toBeCloseTo(truth, 9);
    }
  });

  it('το φράγμα μετρά από το ΣΗΜΕΙΟ: σημείο 25 m έξω εξετάζει λίγα τμήματα, όχι ολόκληρο το χείλος', () => {
    const projection = jest.mocked(segmentParameterNearest);
    let examined = 0;
    const probes = [[SIDE + 25, 7.3], [-25, 12.1], [9.4, SIDE + 25], [3.3, -25], [SIDE + 18, SIDE + 18]];
    for (const [x, y] of probes) {
      projection.mockClear();
      expect(index.nearest(x, y, 30)).not.toBeNull();
      // Η μέτρηση δουλεύει μόνο αν ο μετρητής πιάνει την κλήση — αλλιώς το «λίγα» θα ήταν «κανένα».
      expect(projection.mock.calls.length).toBeGreaterThan(0);
      examined = Math.max(examined, projection.mock.calls.length);
    }
    // Η εξαντλητική σάρωση εξετάζει 80· το παλιό φράγμα εξέταζε περισσότερα (κάθε τμήμα σε κάθε κελί που πατά).
    expect(examined).toBeLessThanOrEqual(ring.length / 4);
    projection.mockClear();
    expect(index.nearest(SIDE + 45, 7.3, 30)).toBeNull();
    // Πιο μακριά από το όριο: η άρνηση δεν κοστίζει ούτε μία προβολή.
    expect(projection.mock.calls.length).toBe(0);
  });
});
