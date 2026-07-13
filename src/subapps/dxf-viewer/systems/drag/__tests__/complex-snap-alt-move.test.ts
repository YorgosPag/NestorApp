/**
 * ADR-642 §6.8 — complex-snap Alt-move helper tests.
 *
 * Verifies that Alt+press on an active complex-linetype pattern snap arms a whole-entity
 * body-drag from the snap point, and that it no-ops for non-complex / entity-less / absent snaps.
 */

import { tryArmComplexSnapAltMove, isComplexSnapMode } from '../complex-snap-alt-move';
import { EntityBodyDragStore } from '../EntityBodyDragStore';
import { setFullSnapResult } from '../../cursor/ImmediateSnapStore';
import { ExtendedSnapType } from '../../../snapping/extended-types';
import type { ProSnapResult, SnapCandidate } from '../../../snapping/extended-types';

function snapResult(cand: Partial<SnapCandidate> | null, found = true): ProSnapResult {
  const snapPoint = cand
    ? {
        point: { x: 10, y: 20 },
        type: ExtendedSnapType.COMPLEX_ENDPOINT,
        description: 'Pattern endpoint',
        distance: 0,
        priority: 0,
        entityId: 'rail_1',
        ...cand,
      }
    : null;
  return {
    found,
    snapPoint,
    allCandidates: snapPoint ? [snapPoint] : [],
    originalPoint: { x: 10, y: 20 },
    snappedPoint: snapPoint?.point ?? { x: 10, y: 20 },
    activeMode: snapPoint?.type ?? null,
    timestamp: 0,
  };
}

afterEach(() => {
  EntityBodyDragStore.clear();
  setFullSnapResult(null);
});

describe('isComplexSnapMode', () => {
  it('is true for the three complex pattern snap types, false otherwise', () => {
    expect(isComplexSnapMode(ExtendedSnapType.COMPLEX_ENDPOINT)).toBe(true);
    expect(isComplexSnapMode(ExtendedSnapType.COMPLEX_MIDPOINT)).toBe(true);
    expect(isComplexSnapMode(ExtendedSnapType.COMPLEX_INTERSECTION)).toBe(true);
    expect(isComplexSnapMode(ExtendedSnapType.ENDPOINT)).toBe(false);
    expect(isComplexSnapMode(null)).toBe(false);
    expect(isComplexSnapMode(undefined)).toBe(false);
  });
});

describe('tryArmComplexSnapAltMove', () => {
  it('arms a whole-entity body-drag from the snap point when a complex snap is active', () => {
    setFullSnapResult(snapResult({ point: { x: 650, y: 1300 }, entityId: 'rail_1' }));
    expect(tryArmComplexSnapAltMove(false)).toBe(true);
    const session = EntityBodyDragStore.getSession();
    expect(session).not.toBeNull();
    expect(session!.anchor).toEqual({ x: 650, y: 1300 });
    expect(session!.entityIds).toEqual(['rail_1']);
    expect(session!.copy).toBe(false);
  });

  it('freezes the copy flag (Ctrl) into the session', () => {
    setFullSnapResult(snapResult({ entityId: 'rail_1' }));
    expect(tryArmComplexSnapAltMove(true)).toBe(true);
    expect(EntityBodyDragStore.isCopy()).toBe(true);
  });

  it('no-ops for a non-complex snap type', () => {
    setFullSnapResult(snapResult({ type: ExtendedSnapType.ENDPOINT, entityId: 'line_1' }));
    expect(tryArmComplexSnapAltMove(false)).toBe(false);
    expect(EntityBodyDragStore.getActive()).toBe(false);
  });

  it('no-ops when the complex snap carries no entity', () => {
    setFullSnapResult(snapResult({ entityId: undefined }));
    expect(tryArmComplexSnapAltMove(false)).toBe(false);
    expect(EntityBodyDragStore.getActive()).toBe(false);
  });

  it('no-ops when there is no active / not-found snap', () => {
    setFullSnapResult(null);
    expect(tryArmComplexSnapAltMove(false)).toBe(false);
    setFullSnapResult(snapResult({ entityId: 'rail_1' }, false));
    expect(tryArmComplexSnapAltMove(false)).toBe(false);
    expect(EntityBodyDragStore.getActive()).toBe(false);
  });
});
