/**
 * ADR-557 — whole-entity Alt «move-from-base-point» POLAR ray is ENTITY-AGNOSTIC.
 *
 * `resolveEndpointReshapePolarLock` used to fire the orange polar ray ONLY for a line/polyline
 * endpoint reshape or a BIM footprint reshape (the `resolveEndpointReshapeAnchor` branches). A
 * text / mtext (or any non-reshape grip) Alt-moved as a whole entity got no fixed neighbour anchor
 * → `null` → no ray, while the neighbouring line DID show one. This suite guards the base-point
 * fallback: when the drag is a whole-entity Alt-move (`isActiveGripAltMove()`), the polar pivots
 * about the base point itself (`anchorPos`), so EVERY entity shows the SAME ray — with NO regression
 * to the existing endpoint (far-end origin) or non-alt (no ray) behaviour.
 *
 * Both seams that draw / commit the ray (`useGripGhostPreview`, `grip-mouseup-handler`) call this
 * ONE SSoT, so proving the resolver keeps preview ≡ commit for the whole-move case.
 */

import type { Point2D } from '../../../rendering/types/Types';

jest.mock('../../../systems/constraints/cad-toggle-state', () => ({
  cadToggleState: { isPolarOn: jest.fn(() => true), isOrthoOn: jest.fn(() => false) },
}));
jest.mock('../../../systems/cursor/GripDragStore', () => ({
  isActiveGripAltMove: jest.fn(() => true),
}));
jest.mock('../../drawing/drawing-handler-utils', () => ({
  resolveOrthoPolarStep: jest.fn(),
}));

import { resolveEndpointReshapePolarLock } from '../grip-endpoint-polar-lock';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { isActiveGripAltMove } from '../../../systems/cursor/GripDragStore';
import { resolveOrthoPolarStep } from '../../drawing/drawing-handler-utils';

const mockPolarOn = cadToggleState.isPolarOn as jest.Mock;
const mockOrthoOn = cadToggleState.isOrthoOn as jest.Mock;
const mockAltMove = isActiveGripAltMove as jest.Mock;
const mockStep = resolveOrthoPolarStep as jest.Mock;

const snapped = (stepped: Point2D, snappedAngle: number, distance = 10) => ({
  stepped,
  polarResult: { isSnapped: true, snappedAngle, distance },
});

beforeEach(() => {
  mockPolarOn.mockReturnValue(true);
  mockOrthoOn.mockReturnValue(false);
  mockAltMove.mockReturnValue(true);
  mockStep.mockReset();
});

describe('ADR-557 — entity-agnostic whole-move base-point polar', () => {
  it('TEXT Alt-move pivots the polar ray about the BASE POINT (anchorPos)', () => {
    mockStep.mockReturnValue(snapped({ x: 7.07, y: 7.07 }, 45));
    const anchorPos = { x: 0, y: 0 };
    const lock = resolveEndpointReshapePolarLock(
      { type: 'text' }, 8, undefined, anchorPos, { x: 10, y: 10 },
    );
    expect(lock).not.toBeNull();
    expect(lock!.fixed).toEqual(anchorPos);
    expect(lock!.delta).toEqual({ x: 7.07, y: 7.07 });
    expect(lock!.polar.snappedAngle).toBe(45);
    // The polar axis MUST be the base point (not the far endpoint / footprint).
    expect(mockStep).toHaveBeenCalledWith({ x: 10, y: 10 }, anchorPos, { ortho: false, polar: true });
  });

  it('MTEXT Alt-move behaves identically (geometry-free base-point origin)', () => {
    mockStep.mockReturnValue(snapped({ x: 0, y: 12 }, 90));
    const anchorPos = { x: 5, y: 5 };
    const lock = resolveEndpointReshapePolarLock(
      { type: 'mtext' }, 8, undefined, anchorPos, { x: 5, y: 20 },
    );
    expect(lock).not.toBeNull();
    expect(lock!.fixed).toEqual(anchorPos);
    expect(lock!.delta).toEqual({ x: -5, y: 7 });
  });

  it('NON-alt drag on a non-reshape entity returns null (no ray — unchanged)', () => {
    mockAltMove.mockReturnValue(false);
    const lock = resolveEndpointReshapePolarLock(
      { type: 'text' }, 8, undefined, { x: 0, y: 0 }, { x: 10, y: 10 },
    );
    expect(lock).toBeNull();
    expect(mockStep).not.toHaveBeenCalled();
  });

  it('LINE ENDPOINT Alt-move keeps the FAR-END origin (no regression)', () => {
    mockStep.mockReturnValue(snapped({ x: 0, y: 10 }, 90));
    const line = { type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
    // Grabbing endpoint 0 (start) → the fixed neighbour is the OTHER end (100,0), not the base point.
    const lock = resolveEndpointReshapePolarLock(
      line, 0, undefined, { x: 0, y: 0 }, { x: 0, y: 10 },
    );
    expect(lock).not.toBeNull();
    expect(lock!.fixed).toEqual({ x: 100, y: 0 });
    expect(mockStep).toHaveBeenCalledWith({ x: 0, y: 10 }, { x: 100, y: 0 }, { ortho: false, polar: true });
  });

  it('returns null when POLAR is off (gate unchanged)', () => {
    mockPolarOn.mockReturnValue(false);
    const lock = resolveEndpointReshapePolarLock(
      { type: 'text' }, 8, undefined, { x: 0, y: 0 }, { x: 10, y: 10 },
    );
    expect(lock).toBeNull();
  });

  it('returns null when the cursor did not snap to a polar ray', () => {
    mockStep.mockReturnValue({ stepped: { x: 3, y: 1 }, polarResult: { isSnapped: false, snappedAngle: null, distance: 3 } });
    const lock = resolveEndpointReshapePolarLock(
      { type: 'text' }, 8, undefined, { x: 0, y: 0 }, { x: 3, y: 1 },
    );
    expect(lock).toBeNull();
  });
});
