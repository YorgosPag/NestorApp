/**
 * ADR-508 §unified-snap (Layered snap architecture Φ1) — `resolveUnifiedCursorSnap`.
 *
 * Επιβεβαιώνει το layered συμβόλαιο: **Layer 2 placement νικά**, αλλιώς **fallback σε
 * Layer 1 point (OSNAP)**, και πάντα έγκυρο σημείο. `findSnapPoint` = injected mock.
 * Scene units = mm (όπως ο dispatcher).
 */

import { resolveUnifiedCursorSnap, type FindSnapPointFn } from '../unified-cursor-snap';
import type { LinearMemberSnapTarget } from '../linear-member-face-snap';
import { ExtendedSnapType, type ProSnapResult } from '../../../snapping/extended-types';

/** Τετράγωνη κολόνα 400×400 (ίδια με τα tests του dispatcher). */
const COLUMN_FP = [
  { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];

/** Γραμμικό μέλος-στόχος κατά μήκος x, πάχος 200 (axis y=0, outline ±100). */
const MEMBER: LinearMemberSnapTarget = {
  id: 'm1',
  axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
  outline: [{ x: 0, y: -100 }, { x: 10000, y: -100 }, { x: 10000, y: 100 }, { x: 0, y: 100 }],
};

/** Mock ProSnapResult που «βρήκε» snap σε δοσμένο σημείο/τύπο. */
function foundAt(point: { x: number; y: number }, type: ExtendedSnapType): ProSnapResult {
  return {
    found: true,
    snapPoint: { point, type, description: 'mock', distance: 0, priority: 0 },
    allCandidates: [],
    originalPoint: point,
    snappedPoint: point,
    activeMode: type,
    timestamp: 0,
  };
}

/** Mock ProSnapResult «δεν βρήκε» snap. */
const NOT_FOUND: ProSnapResult = {
  found: false,
  snapPoint: null,
  allCandidates: [],
  originalPoint: { x: 0, y: 0 },
  snappedPoint: { x: 0, y: 0 },
  activeMode: null,
  timestamp: 0,
};

describe('resolveUnifiedCursorSnap — Layer 2 placement νικά', () => {
  it('Κοντά σε κολόνα → kind=placement, point=placement.start, OSNAP αγνοείται', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt({ x: 9999, y: 9999 }, ExtendedSnapType.ENDPOINT),
    );
    const r = resolveUnifiedCursorSnap({
      cursor: { x: 700, y: 200 },
      columnFootprints: [COLUMN_FP],
      memberTargets: [],
      memberWidthMm: 200,
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('placement');
    if (r.kind === 'placement') {
      expect(r.placement.status).toBe('neutral'); // column-priority
      expect(r.point).toEqual(r.placement.start); // point = κλειδωμένο start
      expect(r.point).toEqual({ x: 400, y: 200 }); // ανατολική παρειά κολόνας
    }
    // Layer 2 νίκησε → δεν χρειάστηκε ο OSNAP (short-circuit).
    expect(findSnapPoint).not.toHaveBeenCalled();
  });

  it('Κοντά σε γραμμικό μέλος → kind=placement (Τ-framing), OSNAP αγνοείται', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt({ x: 9999, y: 9999 }, ExtendedSnapType.ENDPOINT),
    );
    const r = resolveUnifiedCursorSnap({
      cursor: { x: 5000, y: 60 }, // πάνω στο σώμα (|y|<100), μέσα στο μήκος
      columnFootprints: [],
      memberTargets: [MEMBER],
      memberWidthMm: 200,
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('placement');
    if (r.kind === 'placement') {
      expect(r.placement.status).toBe('beam'); // 🟢 κάθετο Τ-framing
      expect(r.point).toEqual(r.placement.start);
    }
    expect(findSnapPoint).not.toHaveBeenCalled();
  });
});

describe('resolveUnifiedCursorSnap — fallback σε Layer 1 point', () => {
  it('Καμία παρειά κοντά + OSNAP βρήκε → kind=point με snappedPoint/snapType/candidate', () => {
    const snapPos = { x: 5012, y: 5008 };
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt(snapPos, ExtendedSnapType.GRID),
    );
    const r = resolveUnifiedCursorSnap({
      cursor: { x: 5000, y: 5000 }, // μακριά από κολόνα/μέλος
      columnFootprints: [COLUMN_FP],
      memberTargets: [MEMBER],
      memberWidthMm: 200,
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') {
      expect(r.point).toEqual(snapPos);
      expect(r.snapType).toBe(ExtendedSnapType.GRID);
      expect(r.candidate).not.toBeNull();
    }
    expect(findSnapPoint).toHaveBeenCalledWith(5000, 5000);
  });

  it('Καμία παρειά + OSNAP δεν βρήκε → kind=point, καθαρός cursor, snapType=null', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => NOT_FOUND,
    );
    const r = resolveUnifiedCursorSnap({
      cursor: { x: 5000, y: 5000 },
      columnFootprints: [],
      memberTargets: [],
      memberWidthMm: 200,
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') {
      expect(r.point).toEqual({ x: 5000, y: 5000 }); // ΑΝΕΠΗΡΕΑΣΤΟΣ cursor
      expect(r.snapType).toBeNull();
      expect(r.candidate).toBeNull();
    }
  });

  it('OSNAP provider null (engine ανενεργός) → kind=point, καθαρός cursor', () => {
    const findSnapPoint: FindSnapPointFn = () => null;
    const r = resolveUnifiedCursorSnap({
      cursor: { x: 123, y: 456 },
      columnFootprints: [],
      memberTargets: [],
      memberWidthMm: 200,
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') {
      expect(r.point).toEqual({ x: 123, y: 456 });
      expect(r.snapType).toBeNull();
    }
  });
});
