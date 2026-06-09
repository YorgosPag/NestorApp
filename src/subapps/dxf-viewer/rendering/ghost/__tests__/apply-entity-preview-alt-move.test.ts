/**
 * ADR-363 Phase 1G.5 — applyEntityPreview Alt whole-entity move ghost.
 *
 * When a preview carries `movesEntity: true` with NO parametric grip-kind, the
 * ghost must translate the WHOLE BIM entity by `delta` through the move SSoT
 * (`calculateBimMovedGeometry`), so the live ghost matches the eventual commit.
 * A parametric grip-kind (e.g. `wallGripKind`) must still take its own branch.
 */

import { applyEntityPreview } from '../apply-entity-preview';
import type { EntityPreviewTransform } from '../entity-preview-types';
import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';

const DELTA = { x: 1000, y: 500 };

function makeWall(): DxfEntityUnion {
  return {
    id: 'wall_1', name: 'W1', type: 'wall', kind: 'straight', layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000, thickness: 250, flip: false,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 5000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as DxfEntityUnion;
}

describe('ADR-363 Phase 1G.5 — applyEntityPreview whole-entity move ghost', () => {
  it('movesEntity + no gripKind → translates the whole wall by delta', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'wall_1', gripIndex: -1, delta: DELTA, movesEntity: true,
    };
    const ghost = applyEntityPreview(makeWall(), preview) as unknown as {
      params: { start: { x: number; y: number; z?: number }; end: { x: number; y: number; z?: number } };
    };
    expect(ghost.params.start).toEqual({ x: 1000, y: 500, z: 0 });
    expect(ghost.params.end).toEqual({ x: 6000, y: 500, z: 0 });
  });

  it('returns the SAME reference for zero delta (no ghost)', () => {
    const wall = makeWall();
    const preview: EntityPreviewTransform = {
      entityId: 'wall_1', gripIndex: -1, delta: { x: 0, y: 0 }, movesEntity: true,
    };
    expect(applyEntityPreview(wall, preview)).toBe(wall);
  });

  it('a parametric wallGripKind still routes through the wall branch (not whole-move)', () => {
    const preview: EntityPreviewTransform = {
      entityId: 'wall_1', gripIndex: 3, delta: DELTA, movesEntity: false,
      wallGripKind: 'wall-thickness', anchorPos: { x: 2500, y: 125 },
    };
    const ghost = applyEntityPreview(makeWall(), preview) as unknown as {
      params: { start: { x: number }; thickness: number };
    };
    // Thickness branch keeps the axis endpoints anchored (start.x unchanged) —
    // proves the whole-entity translate did NOT fire for a parametric kind.
    expect(ghost.params.start.x).toBe(0);
  });
});
