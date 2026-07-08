/**
 * ADR-408 Φ7 P2 — HomeRunWiresOverlay.buildResolver live-follow override.
 *
 * The 2D overlay reads connector world points from the committed scene EXCEPT for
 * the entity being dragged: that host resolves from the PREVIEWED entity (the same
 * `applyEntityPreview` SSoT the ghost uses), so the wire endpoint tracks the drag.
 * Verifies: null preview = committed; a move preview shifts only the dragged host;
 * a preview for a different id leaves the host committed.
 */

import { buildResolver } from '../HomeRunWiresOverlay';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfGripDragPreview } from '../../../hooks/grip-computation';

function fixture(id: string, x: number, y: number) {
  return {
    id,
    type: 'mep-fixture',
    params: {
      kind: 'light-fixture',
      shape: 'rectangular',
      position: { x, y, z: 0 },
      rotation: 0,
      width: 600,
      length: 600,
      mountingElevationMm: 2700,
      sceneUnits: 'mm',
      connectors: [{ connectorId: 'c1', localPosition: { x: 0, y: 0, z: 0 } }],
    },
  };
}

function scene(...entities: unknown[]): DxfScene {
  return { entities } as unknown as DxfScene;
}

const movePreview = (entityId: string, dx: number, dy: number): DxfGripDragPreview => ({
  entityId,
  gripIndex: 0,
  delta: { x: dx, y: dy },
  movesEntity: true,
  gripKind: { on: 'mep-fixture', kind: 'mep-fixture-move' },
});

describe('HomeRunWiresOverlay.buildResolver — live drag follow', () => {
  const sc = scene(fixture('fx1', 10, 0), fixture('fx2', 30, 0));

  it('resolves the committed connector point when there is no drag', () => {
    const r = buildResolver(sc, null);
    expect(r('fx1', 'c1')).toEqual({ x: 10, y: 0, zMm: 2700 });
  });

  it('shifts ONLY the dragged host by the move delta', () => {
    const r = buildResolver(sc, movePreview('fx1', 5, -4));
    expect(r('fx1', 'c1')!.x).toBeCloseTo(15, 6);
    expect(r('fx1', 'c1')!.y).toBeCloseTo(-4, 6);
    // The other fixture stays at its committed position.
    expect(r('fx2', 'c1')).toEqual({ x: 30, y: 0, zMm: 2700 });
  });

  it('leaves the host committed when the drag targets a different entity', () => {
    const r = buildResolver(sc, movePreview('somethingElse', 5, 0));
    expect(r('fx1', 'c1')).toEqual({ x: 10, y: 0, zMm: 2700 });
  });

  it('returns null for an unknown host id', () => {
    expect(buildResolver(sc, null)('ghost', 'c1')).toBeNull();
  });
});
