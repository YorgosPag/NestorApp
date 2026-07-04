/**
 * ADR-562 Φ9.4 — action-drag «tracking pull» aperture.
 *
 * Κλειδώνει το root-cause fix του ΠΡΟΒΛΗΜΑΤΟΣ Α (κυανά/γκρι ίχνη δεν εμφανίζονταν σε MOVE/
 * body-drag): η δημιουργία κρατά την 3px OSNAP hover aperture, αλλά οι interactive action drags
 * χρειάζονται ευρύτερο pull (~8px) γιατί δεν έχουν hover-acquire dwell/POLAR-lock που να κάθεται
 * τον cursor πάνω στον άξονα → το 3px single-anchor projection δεν κουμπώνει ποτέ με το χέρι.
 *
 * Δοκιμάζει `resolveDimAlignmentTracking` απευθείας με `matchTolerancePx` (χωρίς store mocking:
 * `sceneEntities:null` + άδειο TrackingPointStore → ένα μόνο anchor = το refPoint).
 */

import { resolveDimAlignmentTracking } from '../dim-alignment-tracking';
import { TrackingPointStore } from '../../../systems/tracking/TrackingPointStore';

const BASE = { x: 0, y: 0 };
// scale=1 → pixelsToWorld(px,1) === px world units, ώστε «px» === «world» στα νούμερα του test.
const SCALE = 1;

describe('dim-alignment-tracking — action-drag tolerance (ADR-562 Φ9.4)', () => {
  beforeEach(() => TrackingPointStore.clearAll());
  afterEach(() => TrackingPointStore.clearAll());

  it('default (3px) rejects a cursor 5px off the horizontal path from the base', () => {
    // Ό,τι έβλεπε ο MOVE/body-drag πριν το fix: single anchor + στενή aperture → null → «λευκή πινακίδα».
    const result = resolveDimAlignmentTracking({ x: 100, y: 5 }, [BASE], {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
    });
    expect(result).toBeNull();
  });

  it('action aperture (8px) resolves the SAME 5px-off cursor as a horizontal projection', () => {
    // Το fix: ο action wrapper περνά matchTolerancePx:8 → το projection κουμπώνει → ίχνος εμφανίζεται.
    const result = resolveDimAlignmentTracking({ x: 100, y: 5 }, [BASE], {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      matchTolerancePx: 8,
    });
    expect(result).not.toBeNull();
    expect(result!.result.kind).toBe('projection');
    expect(result!.result.activePaths).toHaveLength(1);
    expect(result!.result.activePaths[0].angleDeg).toBe(0); // horizontal trace από το base
    expect(result!.point.y).toBeCloseTo(0); // κουμπωμένο πάνω στη γραμμή y=0 (όχι tilt)
  });

  it('the 8px aperture is still bounded — a 12px-off cursor stays null (δεν «κολλάει» παντού)', () => {
    const result = resolveDimAlignmentTracking({ x: 100, y: 12 }, [BASE], {
      scale: SCALE,
      polarEnabled: false,
      sceneEntities: null,
      matchTolerancePx: 8,
    });
    expect(result).toBeNull();
  });
});
