/**
 * ADR-408 Φ7 FU#3 — shared waypoint gesture SSoT tests (insert / move, idempotent).
 */

import { applyWaypointGesture, type WaypointGesture } from '../mep-wire-waypoint-gesture';
import { buildSegmentKey } from '../mep-wire-waypoints';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';

const SEG = buildSegmentKey('a', 'b');

function makeSystem(params: Partial<MepSystemParams> = {}): MepSystemEntity {
  return {
    id: 's1',
    params: {
      systemType: 'electrical-circuit',
      name: 'C1',
      systemClassification: 'lighting',
      sourceEntityId: 'pnl',
      sourceConnectorId: 'c1',
      members: [],
      ...params,
    },
  };
}

describe('applyWaypointGesture', () => {
  it('inserts a new vertex into an empty segment', () => {
    const system = makeSystem();
    const gesture: WaypointGesture = { mode: 'insert', system, startParams: system.params, keyA: 'a', keyB: 'b', orientedIndex: 0 };
    const next = applyWaypointGesture(gesture, { x: 5, y: 5 });
    expect(next.wireWaypoints?.[SEG]).toEqual([{ x: 5, y: 5 }]);
  });

  it('moves an existing vertex without touching others', () => {
    const system = makeSystem({ wireWaypoints: { [SEG]: [{ x: 1, y: 0 }, { x: 2, y: 0 }] } });
    const gesture: WaypointGesture = { mode: 'move', system, startParams: system.params, keyA: 'a', keyB: 'b', orientedIndex: 1 };
    const next = applyWaypointGesture(gesture, { x: 9, y: 9 });
    expect(next.wireWaypoints?.[SEG]).toEqual([{ x: 1, y: 0 }, { x: 9, y: 9 }]);
  });

  it('is idempotent — always derived from startParams, never accumulates', () => {
    const system = makeSystem();
    const gesture: WaypointGesture = { mode: 'insert', system, startParams: system.params, keyA: 'a', keyB: 'b', orientedIndex: 0 };
    applyWaypointGesture(gesture, { x: 1, y: 1 });
    const second = applyWaypointGesture(gesture, { x: 7, y: 7 });
    // Re-applying with a new point yields a single vertex at the new point.
    expect(second.wireWaypoints?.[SEG]).toEqual([{ x: 7, y: 7 }]);
  });

  it('preserves other params (name, members, colour)', () => {
    const system = makeSystem({ name: 'Circuit X', color: '#abcdef' });
    const gesture: WaypointGesture = { mode: 'insert', system, startParams: system.params, keyA: 'a', keyB: 'b', orientedIndex: 0 };
    const next = applyWaypointGesture(gesture, { x: 0, y: 0 });
    expect(next.name).toBe('Circuit X');
    expect(next.color).toBe('#abcdef');
  });
});
