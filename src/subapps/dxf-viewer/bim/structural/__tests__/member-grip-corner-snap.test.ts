/**
 * ADR-560 §grip-OSNAP-unified — `findMemberGripCornerSnap` tests.
 *
 * Ο generic member corner-source (κολόνα/δοκός/θεμέλιο) πρέπει να προβάλλει τις ΔΙΚΕΣ
 * του footprint-γωνίες στις προτεινόμενες θέσεις (μέσω των ΙΔΙΩΝ `apply*GripDrag` +
 * `compute*Geometry` SSoT) και να επιστρέφει τη διόρθωση cursor ώστε η matched γωνία να
 * κάτσει στον στόχο. Η κολόνα καλύπτεται ήδη μέσω του delegated `findColumnGripCornerSnap`
 * (βλ. `columns/__tests__/column-corner-snap.test.ts`) — εδώ πιάνουμε δοκό, θεμέλιο, τα
 * gate predicates, και τη μη-μέλος περίπτωση.
 */

import {
  findMemberGripCornerSnap,
  isColumnCornerSnapGrip,
  isBeamCornerSnapGrip,
  isFoundationCornerSnapGrip,
} from '../member-grip-corner-snap';
import { applyBeamGripDrag } from '../../beams/beam-grips';
import { applyFoundationGripDrag } from '../../foundations/foundation-grips';
import { computeBeamGeometry } from '../../geometry/beam-geometry';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { FoundationEntity, FoundationParams } from '../../types/foundation-types';
import type { Entity } from '../../../types/entities';
import type { ProSnapResult } from '../../../snapping/extended-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { FindSnapPoint } from '../../../systems/cursor/corner-projection-snap';

const BEAM_PARAMS: BeamParams = {
  kind: 'straight',
  startPoint: { x: 0, y: 0 },
  endPoint: { x: 1000, y: 0 },
  width: 250,
  depth: 500,
  topElevation: 3000,
};

const PAD_PARAMS: FoundationParams = {
  kind: 'pad',
  topElevationMm: -1000,
  thicknessMm: 500,
  position: { x: 0, y: 0, z: 0 },
  width: 1500,
  length: 1500,
  rotation: 0,
  anchor: 'center',
  profile: 'flat',
};

function makeBeam(params: BeamParams = BEAM_PARAMS, id = 'beam_1'): BeamEntity {
  return {
    id, type: 'beam', kind: params.kind, layerId: '0',
    params, geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as BeamEntity;
}

function makeFoundation(params: FoundationParams = PAD_PARAMS, id = 'found_1'): FoundationEntity {
  return {
    id, type: 'foundation', kind: params.kind, layerId: '0',
    params, geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as FoundationEntity;
}

interface Target { near: Point2D; snap: Point2D; dist: number; entityId?: string }

/** Snap-engine stub: first target whose `near` is within `tol` → visible endpoint snap. */
function snapStub(targets: Target[], tol = 60): FindSnapPoint {
  return (x, y) => {
    for (const t of targets) {
      if (Math.hypot(x - t.near.x, y - t.near.y) <= tol) {
        return {
          found: true,
          snappedPoint: { ...t.snap },
          snapPoint: { point: t.snap, type: 'endpoint', description: 'endpoint', distance: t.dist, priority: 0, entityId: t.entityId } as never,
          allCandidates: [],
          originalPoint: { x, y },
          activeMode: 'endpoint' as never,
          timestamp: 0,
          distance: t.dist,
          entityId: t.entityId,
        } as ProSnapResult;
      }
    }
    return null;
  };
}

describe('member corner-snap grip predicates', () => {
  it('column: move/resize true, rotation false', () => {
    expect(isColumnCornerSnapGrip('column-center')).toBe(true);
    expect(isColumnCornerSnapGrip('column-rotation')).toBe(false);
    expect(isColumnCornerSnapGrip(null)).toBe(false);
  });
  it('beam: body kinds true, rotation + curve false', () => {
    expect(isBeamCornerSnapGrip('beam-midpoint')).toBe(true);
    expect(isBeamCornerSnapGrip('beam-width')).toBe(true);
    expect(isBeamCornerSnapGrip('beam-rotation')).toBe(false);
    expect(isBeamCornerSnapGrip('beam-curve')).toBe(false);
    expect(isBeamCornerSnapGrip(null)).toBe(false);
  });
  it('foundation: body kinds true, rotation false', () => {
    expect(isFoundationCornerSnapGrip('foundation-center')).toBe(true);
    expect(isFoundationCornerSnapGrip('foundation-corner-ne')).toBe(true);
    expect(isFoundationCornerSnapGrip('foundation-rotation')).toBe(false);
    expect(isFoundationCornerSnapGrip(null)).toBe(false);
  });
});

describe('findMemberGripCornerSnap — beam whole-body Alt-move', () => {
  it('shifts the cursor so a translated footprint corner lands on the target', () => {
    const beam = makeBeam();
    const dragAnchor: Point2D = { x: 500, y: 0 };
    const cursor: Point2D = { x: 500, y: 1000 }; // delta (0,1000) → whole beam translates
    // Compute the SAME proposed geometry the impl uses, pick a real corner, place the target.
    const proposed = applyBeamGripDrag('beam-midpoint', { originalParams: beam.params, delta: { x: 0, y: 1000 }, currentPos: cursor });
    const v = computeBeamGeometry(proposed).outline.vertices[0];
    const find = snapStub([{ near: { x: v.x, y: v.y }, snap: { x: v.x + 8, y: v.y - 5 }, dist: 9 }]);
    const r = findMemberGripCornerSnap(beam, 'beam-midpoint', dragAnchor, cursor, find, true);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(cursor.x + 8, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(cursor.y - 5, 6);
  });

  it('returns null for the rotation grip without altMove', () => {
    const beam = makeBeam();
    const find = snapStub([{ near: { x: 0, y: 125 }, snap: { x: 5, y: 125 }, dist: 5 }]);
    expect(findMemberGripCornerSnap(beam, 'beam-rotation', { x: 0, y: 0 }, { x: 0, y: 0 }, find)).toBeNull();
  });

  it('returns null when no corner is near a target', () => {
    const beam = makeBeam();
    const find = snapStub([{ near: { x: 9000, y: 9000 }, snap: { x: 9000, y: 9000 }, dist: 1 }]);
    expect(findMemberGripCornerSnap(beam, 'beam-midpoint', { x: 500, y: 0 }, { x: 500, y: 0 }, find, true)).toBeNull();
  });
});

describe('findMemberGripCornerSnap — foundation pad whole-body Alt-move', () => {
  it('shifts the cursor so a translated footprint corner lands on the target', () => {
    const found = makeFoundation();
    const dragAnchor: Point2D = { x: 0, y: 0 };
    const cursor: Point2D = { x: 0, y: 1000 }; // delta (0,1000) → pad translates
    const proposed = applyFoundationGripDrag('foundation-center', { originalParams: found.params, delta: { x: 0, y: 1000 }, currentPos: cursor });
    const v = computeFoundationGeometry(proposed).footprint.vertices[0];
    const find = snapStub([{ near: { x: v.x, y: v.y }, snap: { x: v.x - 6, y: v.y + 4 }, dist: 7 }], 120);
    const r = findMemberGripCornerSnap(found, 'foundation-center', dragAnchor, cursor, find, true);
    expect(r).not.toBeNull();
    expect(r!.adjustedCursorPos.x).toBeCloseTo(cursor.x - 6, 6);
    expect(r!.adjustedCursorPos.y).toBeCloseTo(cursor.y + 4, 6);
  });
});

describe('findMemberGripCornerSnap — non-member entity', () => {
  it('returns null for a plain line (no footprint dispatch)', () => {
    const line = { id: 'ln_1', type: 'line', layerId: '0', visible: true } as unknown as Entity;
    const find = snapStub([{ near: { x: 0, y: 0 }, snap: { x: 0, y: 0 }, dist: 0 }]);
    expect(findMemberGripCornerSnap(line, 'line-start', { x: 0, y: 0 }, { x: 0, y: 0 }, find, true)).toBeNull();
  });
});
