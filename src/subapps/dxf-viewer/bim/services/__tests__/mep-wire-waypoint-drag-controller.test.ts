/**
 * ADR-408 Φ7 FU#3 — MEP wire waypoint drag controller (FSM) tests.
 */

import {
  MepWireWaypointDragController,
  type WaypointDragTarget,
} from '../mep-wire-waypoint-drag-controller';

const TARGET: WaypointDragTarget = { systemId: 's1', keyA: 'a', keyB: 'b', orientedIndex: 0 };

describe('MepWireWaypointDragController', () => {
  it('starts idle', () => {
    const c = new MepWireWaypointDragController();
    expect(c.getState()).toBe('idle');
    expect(c.getTarget()).toBeNull();
    expect(c.updateDrag({ x: 1, y: 1 })).toBeNull();
  });

  it('tracks the cursor point while dragging', () => {
    const c = new MepWireWaypointDragController();
    c.startDrag(TARGET, { x: 5, y: 5 });
    expect(c.getState()).toBe('dragging');
    expect(c.getTarget()).toEqual(TARGET);
    expect(c.getLastPoint()).toEqual({ x: 5, y: 5 });
    expect(c.updateDrag({ x: 8, y: 9 })).toEqual({ x: 8, y: 9 });
    expect(c.getLastPoint()).toEqual({ x: 8, y: 9 });
  });

  it('commits the final point and returns to idle', () => {
    const c = new MepWireWaypointDragController();
    c.startDrag(TARGET, { x: 0, y: 0 });
    c.updateDrag({ x: 3, y: 4 });
    const result = c.endDrag();
    expect(result).toEqual({ target: TARGET, point: { x: 3, y: 4 } });
    expect(c.getState()).toBe('idle');
    expect(c.getTarget()).toBeNull();
  });

  it('endDrag with no active drag resets and returns null', () => {
    const c = new MepWireWaypointDragController();
    expect(c.endDrag()).toBeNull();
    expect(c.getState()).toBe('idle');
  });

  it('cancel returns the target and resets', () => {
    const c = new MepWireWaypointDragController();
    c.startDrag(TARGET, { x: 1, y: 2 });
    expect(c.cancelDrag()).toEqual(TARGET);
    expect(c.getState()).toBe('idle');
    expect(c.getTarget()).toBeNull();
  });
});
