/**
 * Unit tests — applyRectLock / buildRectangleCornersFromLock (ADR-513 §rectangle):
 * SSoT geometry για το AutoCAD-style dynamic input του εργαλείου «Ορθογώνιο».
 * Απόφαση A (locked νικά): κλειδωμένη πλευρά = σταθερό μέγεθος + πρόσημο από cursor·
 * μη-κλειδωμένη = προβολή cursor. Απόφαση B: rotation γράφεται στο entity.
 */

import { applyRectLock, buildRectangleCornersFromLock } from '../rect-lock';
import { RectLockStore } from '../RectLockStore';
import { createRectangleVertices } from '../../../rendering/entities/shared/geometry-utils';

const C1 = { x: 100, y: 100 };

describe('applyRectLock', () => {
  describe('no lock — σημερινή συμπεριφορά (μηδέν regression)', () => {
    it('corner2 = cursor, rotation = 0 όταν δεν υπάρχει lock', () => {
      const out = applyRectLock(C1, { x: 130, y: 140 }, { width: null, height: null, angle: null });
      expect(out.corner2).toEqual({ x: 130, y: 140 });
      expect(out.rotation).toBe(0);
    });
  });

  describe('width lock — σταθερό πλάτος, πρόσημο από cursor', () => {
    it('κρατά το πλάτος, παίρνει το ύψος από τον cursor (πάνω-δεξιά)', () => {
      const out = applyRectLock(C1, { x: 103, y: 140 }, { width: 5, height: null, angle: null });
      expect(out.corner2.x).toBeCloseTo(105); // 100 + 5 (πρόσημο +, cursor δεξιά)
      expect(out.corner2.y).toBeCloseTo(140); // ελεύθερο ύψος από cursor
    });

    it('αντιστρέφει το πρόσημο του πλάτους όταν ο cursor είναι αριστερά', () => {
      const out = applyRectLock(C1, { x: 90, y: 140 }, { width: 5, height: null, angle: null });
      expect(out.corner2.x).toBeCloseTo(95); // 100 - 5
    });
  });

  describe('height lock — σταθερό ύψος, πρόσημο από cursor', () => {
    it('κρατά το ύψος, παίρνει το πλάτος από τον cursor', () => {
      const out = applyRectLock(C1, { x: 130, y: 108 }, { width: null, height: 5, angle: null });
      expect(out.corner2.x).toBeCloseTo(130); // ελεύθερο πλάτος
      expect(out.corner2.y).toBeCloseTo(105); // 100 + 5
    });

    it('αντιστρέφει το πρόσημο του ύψους όταν ο cursor είναι κάτω', () => {
      const out = applyRectLock(C1, { x: 130, y: 90 }, { width: null, height: 5, angle: null });
      expect(out.corner2.y).toBeCloseTo(95); // 100 - 5
    });
  });

  describe('angle lock — τοπικοί (περιστραμμένοι) άξονες + τεταρτημόριο', () => {
    it('γωνία 90°: corner2 = ΤΟΠΙΚΑ extents (unrotated)· η στροφή εφαρμόζεται στο render', () => {
      // cursor (90,130), corner1 (100,100): d=(-10,30). ex=(0,1)→pw=30>0, ey=(-1,0)→ph=10>0.
      const out = applyRectLock(C1, { x: 90, y: 130 }, { width: 4, height: 3, angle: 90 });
      expect(out.rotation).toBe(90);
      // corner2 κρατά ΤΟΠΙΚΕΣ (unrotated) συντεταγμένες = corner1 + (w,h) = (104,103).
      expect(out.corner2.x).toBeCloseTo(104);
      expect(out.corner2.y).toBeCloseTo(103);
    });

    it('η τελική (render) κορυφή = corner1 + w·ex + h·ey μετά την περιστροφή περί corner1', () => {
      const out = applyRectLock(C1, { x: 90, y: 130 }, { width: 4, height: 3, angle: 90 });
      // createRectangleVertices(corner1, corner2, 90)[2] = η απέναντι (c2) κορυφή στο world.
      const rendered = createRectangleVertices(C1, out.corner2, out.rotation);
      // (100,100) + 4·(0,1) + 3·(-1,0) = (97,104)
      expect(rendered[2].x).toBeCloseTo(97);
      expect(rendered[2].y).toBeCloseTo(104);
    });
  });

  describe('και τα 3 locked — ντετερμινιστικό ανεξ. μεγέθους cursor', () => {
    it('ίδιο corner2/rotation· ο cursor δίνει μόνο πρόσημο (τεταρτημόριο)', () => {
      const locks = { width: 6, height: 4, angle: 0 };
      const near = applyRectLock(C1, { x: 101, y: 101 }, locks);
      const far = applyRectLock(C1, { x: 500, y: 500 }, locks);
      expect(near.corner2).toEqual(far.corner2); // μέγεθος cursor δεν μετράει
      expect(near.corner2).toEqual({ x: 106, y: 104 });
      expect(near.rotation).toBe(0);
    });
  });
});

describe('buildRectangleCornersFromLock', () => {
  afterEach(() => RectLockStore.unlockAll());

  it('διαβάζει τα ζωντανά locks του RectLockStore', () => {
    RectLockStore.lockWidth(10);
    const out = buildRectangleCornersFromLock(C1, { x: 130, y: 140 });
    expect(out.corner2.x).toBeCloseTo(110); // 100 + 10 (locked width)
    expect(out.corner2.y).toBeCloseTo(140); // free height
  });

  it('χωρίς lock → corner2 = cursor (σημερινή συμπεριφορά)', () => {
    const out = buildRectangleCornersFromLock(C1, { x: 130, y: 140 });
    expect(out.corner2).toEqual({ x: 130, y: 140 });
    expect(out.rotation).toBe(0);
  });
});
