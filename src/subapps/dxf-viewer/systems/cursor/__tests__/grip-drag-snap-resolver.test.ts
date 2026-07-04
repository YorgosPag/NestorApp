/**
 * ADR-560 §grip-OSNAP-unified — `resolveGripDragSnap` tests.
 *
 * Η ΜΙΑ πηγή αλήθειας του grip-drag OSNAP (κοινή move+up): corner-source dispatch
 * (τοίχος → face· μέλος → footprint) + ο κοινός priority resolver (ορατή γωνία >
 * ορατό cursor > σιωπηλό grid → null). Επίσης τα publish/clear helpers (3 κανάλια).
 */

import { resolveGripDragSnap, publishGripSnap, clearGripSnap } from '../grip-drag-snap-resolver';
import { getFullSnapResult, setFullSnapResult } from '../ImmediateSnapStore';
import type { ActiveDragGripInfo } from '../GripDragStore';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import type { Entity } from '../../../types/entities';
import type { ProSnapResult } from '../../../snapping/extended-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { FindSnapPoint } from '../corner-projection-snap';

function makeColumn(x: number, y: number, id = 'col_1'): ColumnEntity {
  const params: ColumnParams = buildDefaultColumnParams({ x, y }, 'rectangular');
  return {
    id, type: 'column', kind: params.kind, layerId: '0',
    params, geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as ColumnEntity;
}

function makeWall(id = 'wall_1'): WallEntity {
  return {
    id, type: 'wall', kind: 'straight', layerId: '0',
    params: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 200, sceneUnits: 'mm' },
    geometry: undefined as never, validation: undefined as never, visible: true,
  } as unknown as WallEntity;
}

interface Target { near: Point2D; snap: Point2D; mode?: string; dist?: number; entityId?: string }

function snapStub(targets: Target[], tol = 60): FindSnapPoint {
  return (x, y) => {
    for (const t of targets) {
      if (Math.hypot(x - t.near.x, y - t.near.y) <= tol) {
        const mode = t.mode ?? 'endpoint';
        return {
          found: true,
          snappedPoint: { ...t.snap },
          snapPoint: { point: t.snap, type: mode, description: mode, distance: t.dist ?? 0, priority: 0, entityId: t.entityId } as never,
          allCandidates: [],
          originalPoint: { x, y },
          activeMode: mode as never,
          timestamp: 0,
          distance: t.dist ?? 0,
          entityId: t.entityId,
        } as ProSnapResult;
      }
    }
    return null;
  };
}

const grip = (o: Partial<ActiveDragGripInfo> & { entityId: string }): ActiveDragGripInfo => ({
  gripKind: null, ...o,
});

describe('resolveGripDragSnap — corner-source dispatch', () => {
  it('column: footprint corner projection wins (visible)', () => {
    const col = makeColumn(0, 0);
    // Move base (0,0), cursor (1000,1000) → NE corner (1200,1200); target 10 off.
    const find = snapStub([{ near: { x: 1200, y: 1200 }, snap: { x: 1210, y: 1210 }, dist: 14 }]);
    const g = grip({ entityId: 'col_1', gripKind: 'column-center', dragAnchor: { x: 0, y: 0 } });
    const r = resolveGripDragSnap([col as unknown as Entity], g, { x: 1000, y: 1000 }, find, false);
    expect(r).not.toBeNull();
    expect(r!.moveWorldPos.x).toBeCloseTo(1010, 6);
    expect(r!.moveWorldPos.y).toBeCloseTo(1010, 6);
    expect(r!.snapResult.snappedPoint).toEqual({ x: 1210, y: 1210 });
  });

  it('wall: face-corner projection wins (dragging an endpoint grip)', () => {
    const wall = makeWall();
    // wall-end drag, cursor at (1000,0); face corners at (1000,±100). Target off +face.
    const find = snapStub([{ near: { x: 1000, y: 100 }, snap: { x: 1010, y: 100 }, dist: 10 }]);
    const g = grip({ entityId: 'wall_1', gripKind: 'wall-end' });
    const r = resolveGripDragSnap([wall as unknown as Entity], g, { x: 1000, y: 0 }, find, false);
    expect(r).not.toBeNull();
    expect(r!.moveWorldPos.x).toBeCloseTo(1010, 6);
    expect(r!.moveWorldPos.y).toBeCloseTo(0, 6);
  });
});

describe('resolveGripDragSnap — priority', () => {
  it('falls back to the visible cursor snap when no corner projects', () => {
    const col = makeColumn(0, 0);
    // cursor far away so its corners miss; a visible characteristic sits under the crosshair.
    const find = snapStub([{ near: { x: 5000, y: 5000 }, snap: { x: 5001, y: 5002 }, dist: 3 }]);
    const g = grip({ entityId: 'col_1', gripKind: 'column-center', dragAnchor: { x: 0, y: 0 } });
    const r = resolveGripDragSnap([col as unknown as Entity], g, { x: 5000, y: 5000 }, find, false);
    expect(r).not.toBeNull();
    expect(r!.moveWorldPos).toEqual({ x: 5001, y: 5002 });
  });

  it('returns null for a SILENT grid snap (grip rejects invisible pulls)', () => {
    const col = makeColumn(0, 0);
    const find = snapStub([{ near: { x: 5000, y: 5000 }, snap: { x: 5000, y: 5000 }, mode: 'grid' }]);
    const g = grip({ entityId: 'col_1', gripKind: 'column-center', dragAnchor: { x: 0, y: 0 } });
    expect(resolveGripDragSnap([col as unknown as Entity], g, { x: 5000, y: 5000 }, find, false)).toBeNull();
  });

  it('returns null with no active grip or no entities', () => {
    const find = snapStub([]);
    expect(resolveGripDragSnap([], null, { x: 0, y: 0 }, find, false)).toBeNull();
    const g = grip({ entityId: 'x', gripKind: 'column-center' });
    expect(resolveGripDragSnap(null, g, { x: 0, y: 0 }, find, false)).toBeNull();
  });
});

describe('publishGripSnap / clearGripSnap', () => {
  const sample: ProSnapResult = {
    found: true,
    snappedPoint: { x: 3, y: 4 },
    snapPoint: { point: { x: 3, y: 4 }, type: 'endpoint', description: 'endpoint', distance: 0, priority: 0 } as never,
    allCandidates: [],
    originalPoint: { x: 3, y: 4 },
    activeMode: 'endpoint' as never,
    timestamp: 0,
  } as ProSnapResult;

  it('publishGripSnap writes the marker SSoT + React channel', () => {
    setFullSnapResult(null);
    const setSnapResults = jest.fn();
    publishGripSnap(sample, setSnapResults);
    expect(getFullSnapResult()).toBe(sample);
    expect(setSnapResults).toHaveBeenCalledTimes(1);
    expect(setSnapResults.mock.calls[0][0][0]).toMatchObject({ point: { x: 3, y: 4 }, type: 'endpoint' });
  });

  it('clearGripSnap clears the marker SSoT + React channel', () => {
    setFullSnapResult(sample);
    const setSnapResults = jest.fn();
    clearGripSnap(setSnapResults);
    expect(getFullSnapResult()).toBeNull();
    expect(setSnapResults).toHaveBeenCalledWith([]);
  });
});
