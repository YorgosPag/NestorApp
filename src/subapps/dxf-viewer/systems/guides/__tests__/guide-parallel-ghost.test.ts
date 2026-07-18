/**
 * guide-parallel-ghost — πινακοποιεί τη γεωμετρία του φαντάσματος-οδηγού
 * (ADR-189 §3.13) για X/Y (offset) και XZ (diagonal) οδηγούς, με και χωρίς
 * πληκτρολογημένη απόσταση.
 *
 * Το κρίσιμο invariant (βλ. σχόλιο στο source): sign(perpProjection) πρέπει
 * ΠΑΝΤΑ να ταυτίζεται με resolveParallelSide — αλλιώς το φάντασμα και το
 * committed αποτέλεσμα του Enter καταλήγουν σε αντίθετες πλευρές.
 */

import {
  perpendicularNormal,
  resolveParallelGhostOffset,
  resolveParallelGhostDiagonal,
} from '../guide-parallel-ghost';
import { resolveParallelSide } from '../guide-parallel-side';
import type { Guide, Point2D } from '../guide-types';

/** Ελάχιστος έγκυρος Guide — γεμίζει τα υποχρεωτικά runtime-state πεδία. */
function makeGuide(overrides: Partial<Guide> & Pick<Guide, 'axis'>): Guide {
  return {
    id: 'guide_test_001',
    offset: 0,
    label: null,
    style: null,
    visible: true,
    locked: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    parentId: null,
    groupId: null,
    ...overrides,
  };
}

describe('perpendicularNormal', () => {
  it('επιστρέφει το μοναδιαίο κάθετο διάνυσμα (-dy, dx)/len', () => {
    const n = perpendicularNormal({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(n).not.toBeNull();
    expect(n!.x).toBeCloseTo(-1 / Math.SQRT2, 6);
    expect(n!.y).toBeCloseTo(1 / Math.SQRT2, 6);
    // Μοναδιαίο μήκος.
    expect(Math.hypot(n!.x, n!.y)).toBeCloseTo(1, 6);
  });

  it('null για εκφυλισμένο segment (μηδενικού μήκους)', () => {
    expect(perpendicularNormal({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe('resolveParallelGhostOffset', () => {
  describe('typedDistance === null → ακολουθεί τον κέρσορα', () => {
    it("axis 'X' → επιστρέφει cursor.x", () => {
      const guide = makeGuide({ axis: 'X', offset: 10 });
      expect(resolveParallelGhostOffset(guide, { x: 7, y: 99 }, null)).toBe(7);
    });

    it("axis 'Y' → επιστρέφει cursor.y", () => {
      const guide = makeGuide({ axis: 'Y', offset: 10 });
      expect(resolveParallelGhostOffset(guide, { x: 99, y: 7 }, null)).toBe(7);
    });
  });

  describe('typedDistance δοσμένη → κουμπώνει σε offset ± typed, ανάλογα με την πλευρά', () => {
    it.each([
      ['X', { x: 18, y: 0 }, 15],
      ['X', { x: 2, y: 0 }, 5],
      ['Y', { x: 0, y: 18 }, 15],
      ['Y', { x: 0, y: 2 }, 5],
    ] as const)('axis %s, cursor %o → %d', (axis, cursor, expected) => {
      const guide = makeGuide({ axis, offset: 10 });
      expect(resolveParallelGhostOffset(guide, cursor, 5)).toBe(expected);
    });
  });
});

describe('resolveParallelGhostDiagonal', () => {
  const start: Point2D = { x: 0, y: 0 };
  const end: Point2D = { x: 10, y: 10 };

  it('null για μη-XZ οδηγό', () => {
    const guide = makeGuide({ axis: 'X', offset: 10 });
    expect(resolveParallelGhostDiagonal(guide, { x: 0, y: 0 }, null)).toBeNull();
  });

  it('null για XZ οδηγό χωρίς startPoint/endPoint', () => {
    const guide = makeGuide({ axis: 'XZ' });
    expect(resolveParallelGhostDiagonal(guide, { x: 0, y: 0 }, null)).toBeNull();
  });

  it('null για εκφυλισμένο XZ segment (startPoint === endPoint)', () => {
    const guide = makeGuide({ axis: 'XZ', startPoint: { x: 3, y: 3 }, endPoint: { x: 3, y: 3 } });
    expect(resolveParallelGhostDiagonal(guide, { x: 0, y: 0 }, null)).toBeNull();
  });

  it('typedDistance === null → μετατοπίζει το segment κατά την κάθετη προβολή του κέρσορα', () => {
    const guide = makeGuide({ axis: 'XZ', startPoint: start, endPoint: end });
    const result = resolveParallelGhostDiagonal(guide, { x: 0, y: 10 }, null);

    expect(result).not.toBeNull();
    // n = (-1/√2, 1/√2); perpProjection = (0-0)*nx + (10-0)*ny = 10/√2.
    expect(result!.start.x).toBeCloseTo(-5, 6);
    expect(result!.start.y).toBeCloseTo(5, 6);
    expect(result!.end.x).toBeCloseTo(5, 6);
    expect(result!.end.y).toBeCloseTo(15, 6);
  });

  it('typedDistance δοσμένη → μετατοπίζει ΑΚΡΙΒΩΣ κατά typed, προς την πλευρά του κέρσορα', () => {
    const guide = makeGuide({ axis: 'XZ', startPoint: start, endPoint: end });
    const cursor: Point2D = { x: 0, y: 10 }; // πάνω-αριστερά της διαγωνίου
    const typed = 5;
    const result = resolveParallelGhostDiagonal(guide, cursor, typed);

    expect(result).not.toBeNull();

    // Η απόσταση του νέου segment από το αρχικό ισούται με την typed τιμή.
    const shiftDistance = Math.hypot(result!.start.x - start.x, result!.start.y - start.y);
    expect(shiftDistance).toBeCloseTo(typed, 6);

    // Η φορά της μετατόπισης ταιριάζει με την πλευρά που δίνει resolveParallelSide.
    const n = perpendicularNormal(start, end)!;
    const perpDist = (result!.start.x - start.x) * n.x + (result!.start.y - start.y) * n.y;
    expect(Math.sign(perpDist)).toBe(resolveParallelSide(guide, cursor));
  });

  it('typedDistance δοσμένη σε αντίθετη πλευρά → μετατοπίζει προς την ΑΝΤΙΘΕΤΗ φορά', () => {
    const guide = makeGuide({ axis: 'XZ', startPoint: start, endPoint: end });
    const cursor: Point2D = { x: 10, y: 0 }; // κάτω-δεξιά της διαγωνίου
    const typed = 5;
    const result = resolveParallelGhostDiagonal(guide, cursor, typed);

    expect(result).not.toBeNull();
    expect(result!.start.x).toBeGreaterThan(start.x);
    expect(result!.start.y).toBeLessThan(start.y);

    const n = perpendicularNormal(start, end)!;
    const perpDist = (result!.start.x - start.x) * n.x + (result!.start.y - start.y) * n.y;
    expect(Math.sign(perpDist)).toBe(resolveParallelSide(guide, cursor));
  });

  describe('sign-invariant: sign(perpProjection) === resolveParallelSide(guide, cursor)', () => {
    it.each([
      ['διαγώνιος (0,0)→(10,10), κέρσορας πάνω-αριστερά', start, end, { x: 0, y: 10 } as Point2D],
      ['διαγώνιος (0,0)→(10,10), κέρσορας κάτω-δεξιά', start, end, { x: 10, y: 0 } as Point2D],
      ['διαγώνιος (0,0)→(10,0) (οριζόντια), κέρσορας πάνω', { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 } as Point2D],
      ['διαγώνιος (0,0)→(10,0) (οριζόντια), κέρσορας κάτω', { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 } as Point2D],
      ['διαγώνιος (0,0)→(0,10) (κατακόρυφη), κέρσορας δεξιά', { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 5, y: 5 } as Point2D],
      ['διαγώνιος (0,0)→(0,10) (κατακόρυφη), κέρσορας αριστερά', { x: 0, y: 0 }, { x: 0, y: 10 }, { x: -5, y: 5 } as Point2D],
      ['διαγώνιος (2,3)→(8,-1), κέρσορας τυχαίος', { x: 2, y: 3 }, { x: 8, y: -1 }, { x: 1, y: -4 } as Point2D],
    ] as const)('%s', (_label, segStart, segEnd, cursor) => {
      const guide = makeGuide({ axis: 'XZ', startPoint: segStart, endPoint: segEnd });
      const n = perpendicularNormal(segStart, segEnd)!;
      const perpProjection = (cursor.x - segStart.x) * n.x + (cursor.y - segStart.y) * n.y;

      expect(Math.sign(perpProjection)).toBe(resolveParallelSide(guide, cursor));
    });
  });
});
