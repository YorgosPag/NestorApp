/**
 * ADR-514 — «Ένας Εγκέφαλος Έλξης» (`resolveBimCursorSnap`). Επιβεβαιώνει το tool-agnostic
 * dispatch: column/wall/beam → placement (Layer 2), αλλιώς → OSNAP point (Layer 1), πάντα
 * έγκυρο σημείο. `findSnapPoint` = injected mock. Scene units = mm.
 */

import { resolveBimCursorSnap, type FindSnapPointFn } from '../bim-cursor-snap';
import type { SceneSnapTargets } from '../../framing/scene-snap-targets';
import { ExtendedSnapType, type ProSnapResult } from '../../../snapping/extended-types';

/** Τετράγωνη κολόνα 400×400 (ίδια με τα tests των resolvers). */
const COLUMN_FP = [
  { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];

/** Κενοί στόχοι σκηνής + override ό,τι χρειάζεται το test. */
function makeTargets(partial: Partial<SceneSnapTargets> = {}): SceneSnapTargets {
  return {
    footprints: [],
    beamTargets: [],
    wallTargets: [],
    slabTargets: [],
    lineTargets: [],
    diskTargets: [],
    rectTargets: [],
    wallEntities: [],
    openings: [],
    ...partial,
  };
}

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

const NOT_FOUND: ProSnapResult = {
  found: false, snapPoint: null, allCandidates: [],
  originalPoint: { x: 0, y: 0 }, snappedPoint: { x: 0, y: 0 }, activeMode: null, timestamp: 0,
};

describe('resolveBimCursorSnap — Layer 2 placement (ανά toolKind)', () => {
  it('column κοντά σε footprint → kind=column-placement, point=placement.position, OSNAP αγνοείται', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt({ x: 9999, y: 9999 }, ExtendedSnapType.ENDPOINT),
    );
    const r = resolveBimCursorSnap({
      toolKind: 'column',
      cursor: { x: 700, y: 200 },
      targets: makeTargets({ footprints: [COLUMN_FP] }),
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('column-placement');
    if (r.kind === 'column-placement') {
      expect(r.point).toEqual(r.placement.position);
      expect(r.placement.position.x).toBeCloseTo(400); // ανατολική παρειά κολόνας
    }
    expect(findSnapPoint).not.toHaveBeenCalled();
  });

  it('wall κοντά σε footprint → kind=member-placement (column-priority neutral), point=placement.start', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt({ x: 9999, y: 9999 }, ExtendedSnapType.ENDPOINT),
    );
    const r = resolveBimCursorSnap({
      toolKind: 'wall',
      cursor: { x: 700, y: 200 },
      targets: makeTargets({ footprints: [COLUMN_FP] }),
      sceneUnits: 'mm',
      memberWidthMm: 200,
      findSnapPoint,
    });
    expect(r.kind).toBe('member-placement');
    if (r.kind === 'member-placement') {
      expect(r.placement.status).toBe('neutral');
      expect(r.point).toEqual(r.placement.start);
      expect(r.point).toEqual({ x: 400, y: 200 });
    }
    expect(findSnapPoint).not.toHaveBeenCalled();
  });
});

describe('resolveBimCursorSnap — Layer 1 point fallback', () => {
  it('wall χωρίς στόχο κοντά + OSNAP βρήκε → kind=point με snappedPoint/snapType/candidate', () => {
    const snapPos = { x: 5012, y: 5008 };
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt(snapPos, ExtendedSnapType.GRID),
    );
    const r = resolveBimCursorSnap({
      toolKind: 'wall',
      cursor: { x: 5000, y: 5000 },
      targets: makeTargets({ footprints: [COLUMN_FP] }), // μακριά → εκτός capture
      sceneUnits: 'mm',
      memberWidthMm: 200,
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

  it('point-only → ΠΑΝΤΑ παρακάμπτει placement, καλεί findSnapPoint ακόμη κι αν υπάρχουν στόχοι', () => {
    const findSnapPoint = jest.fn<ReturnType<FindSnapPointFn>, Parameters<FindSnapPointFn>>(
      () => foundAt({ x: 11, y: 22 }, ExtendedSnapType.ENDPOINT),
    );
    const r = resolveBimCursorSnap({
      toolKind: 'point-only',
      cursor: { x: 700, y: 200 },
      targets: makeTargets({ footprints: [COLUMN_FP] }), // κοντά, αλλά point-only → αγνοεί
      sceneUnits: 'mm',
      findSnapPoint,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') expect(r.point).toEqual({ x: 11, y: 22 });
    expect(findSnapPoint).toHaveBeenCalledWith(700, 200);
  });

  it('κανένα placement + OSNAP δεν βρήκε → kind=point, καθαρός cursor, snapType=null', () => {
    const r = resolveBimCursorSnap({
      toolKind: 'beam',
      cursor: { x: 123, y: 456 },
      targets: makeTargets(),
      sceneUnits: 'mm',
      memberWidthMm: 200,
      findSnapPoint: () => NOT_FOUND,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') {
      expect(r.point).toEqual({ x: 123, y: 456 });
      expect(r.snapType).toBeNull();
      expect(r.candidate).toBeNull();
    }
  });

  it('OSNAP provider null (engine ανενεργός) → kind=point, καθαρός cursor', () => {
    const r = resolveBimCursorSnap({
      toolKind: 'point-only',
      cursor: { x: 1, y: 2 },
      targets: makeTargets(),
      sceneUnits: 'mm',
      findSnapPoint: () => null,
    });
    expect(r.kind).toBe('point');
    if (r.kind === 'point') expect(r.point).toEqual({ x: 1, y: 2 });
  });
});
