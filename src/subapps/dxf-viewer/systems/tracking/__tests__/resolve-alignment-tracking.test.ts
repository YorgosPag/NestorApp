/**
 * Canonical Object-Snap-Tracking resolver — per-context anchors (SSoT).
 *
 * Κλειδώνει ότι ο ΕΝΑΣ `resolveAlignmentTracking` (systems/tracking) δέχεται τα per-context
 * inputs που πριν ζούσαν διπλά στον dim wrapper: `refPoints` (ρητά transient anchors) +
 * `matchTolerancePx`. Ο `resolveDimAlignmentTracking` είναι πλέον thin adapter από πάνω —
 * αυτά τα tests ελέγχουν τη ΜΙΑ πηγή αλήθειας απευθείας (Revit/AutoCAD-OTRACK: ένας solver,
 * per-context anchors).
 *
 * Χωρίς store mocking: `sceneEntities:null` + άδειο TrackingPointStore ⇒ μόνο τα `refPoints`
 * είναι anchors, οπότε το αποτέλεσμα είναι ντετερμινιστικό.
 */

import { resolveAlignmentTracking } from '../resolve-alignment-tracking';
import { TrackingPointStore } from '../TrackingPointStore';

const BASE = { x: 0, y: 0 };
// scale=1 → pixelsToWorld(px,1) === px world units ⇒ «px» === «world» στα νούμερα του test.
const SCALE = 1;

describe('resolveAlignmentTracking — canonical per-context resolver', () => {
  beforeEach(() => TrackingPointStore.clearAll());
  afterEach(() => TrackingPointStore.clearAll());

  it('no refPoints + empty store + no ambient ⇒ null (store-only parity σχεδίασης/περιστροφής)', () => {
    const result = resolveAlignmentTracking({ x: 100, y: 0 }, {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      // segmentBase μόνο του δεν φτιάχνει anchor — χωρίς acquired/ambient → null (όπως πριν).
      segmentBase: BASE,
    });
    expect(result).toBeNull();
  });

  it('refPoints participate ως anchors ⇒ ο cursor πάνω στον οριζόντιο άξονα κουμπώνει (projection)', () => {
    const result = resolveAlignmentTracking({ x: 100, y: 0 }, {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      refPoints: [BASE],
    });
    expect(result).not.toBeNull();
    expect(result!.result.kind).toBe('projection');
    expect(result!.result.activePaths).toHaveLength(1);
    expect(result!.result.activePaths[0].angleDeg).toBe(0);
  });

  it('default aperture = 3px: cursor 5px off τον refPoint άξονα ⇒ null', () => {
    const result = resolveAlignmentTracking({ x: 100, y: 5 }, {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      refPoints: [BASE],
    });
    expect(result).toBeNull();
  });

  it('matchTolerancePx:8 (action pull) resolves τον ίδιο 5px-off cursor ως horizontal projection', () => {
    const result = resolveAlignmentTracking({ x: 100, y: 5 }, {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      refPoints: [BASE],
      matchTolerancePx: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.result.kind).toBe('projection');
    expect(result!.result.activePaths[0].angleDeg).toBe(0);
    expect(result!.point.y).toBeCloseTo(0);
  });
});
