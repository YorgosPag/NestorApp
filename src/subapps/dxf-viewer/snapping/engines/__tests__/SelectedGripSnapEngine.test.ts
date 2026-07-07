/**
 * ADR-580 — SelectedGripSnapEngine (selected-object grip precedence) tests.
 *
 * Verifies:
 *   - Empty AllGripsStore → no candidates (zero cost when nothing is selected).
 *   - Surfaces the selected objects' grips within radius, correct type + priority, caps at 8.
 *   - Respects `context.excludeEntityId` AND the active grip drag (`GripDragStore`) → never
 *     snaps a dragged vertex back onto its own entity's grips.
 *   - The SELECTED_GRIP priority WINS the coincidence tiebreak over a coincident (even closer)
 *     ENDPOINT of an unselected entity — the exact "grab the grip, not the entity under it" fix.
 */

import { SelectedGripSnapEngine } from '../SelectedGripSnapEngine';
import { AllGripsStore } from '../../../systems/grip/AllGripsStore';
import { setActiveDragGrip, clearActiveDragGrip } from '../../../systems/cursor/GripDragStore';
import { SnapCandidateProcessor } from '../../orchestrator/SnapCandidateProcessor';
import { ExtendedSnapType, DEFAULT_PRO_SNAP_SETTINGS, type SnapCandidate } from '../../extended-types';
import { SNAP_ENGINE_PRIORITIES } from '../../../config/tolerance-config';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';

function makeContext(radius = 50, excludeEntityId?: string): SnapEngineContext {
  return {
    entities: [],
    worldRadiusAt: () => radius,
    worldRadiusForType: () => radius,
    maxCandidates: 16,
    excludeEntityId,
  };
}

function grip(entityId: string, gripIndex: number, x: number, y: number): UnifiedGripInfo {
  return {
    id: `dxf_${entityId}_${gripIndex}`,
    source: 'dxf',
    entityId,
    gripIndex,
    type: 'vertex',
    position: { x, y },
    movesEntity: false,
  };
}

const engine = new SelectedGripSnapEngine();

afterEach(() => {
  AllGripsStore.clear();
  clearActiveDragGrip();
});

describe('SelectedGripSnapEngine', () => {
  it('no candidates when nothing is selected (empty store)', () => {
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('surfaces only grips within radius, correct type + priority', () => {
    AllGripsStore.set([
      grip('hatch-1', 0, 0, 0),      // near
      grip('hatch-1', 1, 1000, 0),   // far
    ]);
    const { candidates } = engine.findSnapCandidates({ x: 3, y: 0 }, makeContext(50));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.SELECTED_GRIP);
    expect(candidates[0]!.priority).toBe(SNAP_ENGINE_PRIORITIES.SELECTED_GRIP);
    expect(candidates[0]!.entityId).toBe('hatch-1');
  });

  it('caps at 8 candidates on a dense boundary', () => {
    AllGripsStore.set(Array.from({ length: 20 }, (_, i) => grip('hatch-1', i, 0, 0)));
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext(50)).candidates).toHaveLength(8);
  });

  it('respects context.excludeEntityId (skips that entity’s grips)', () => {
    AllGripsStore.set([grip('hatch-1', 0, 0, 0), grip('line-2', 0, 0, 0)]);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext(50, 'hatch-1'));
    expect(candidates.every((c) => c.entityId !== 'hatch-1')).toBe(true);
    expect(candidates.map((c) => c.entityId)).toContain('line-2');
  });

  it('excludes the actively-dragged entity (no self-snap-back onto its own grips)', () => {
    AllGripsStore.set([grip('hatch-1', 0, 0, 0), grip('hatch-1', 1, 0, 0)]);
    setActiveDragGrip({ entityId: 'hatch-1', gripKind: 'hatch-vertex-0-0' });
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext(50)).candidates).toHaveLength(0);
  });
});

describe('SELECTED_GRIP precedence over a coincident underlying ENDPOINT (ADR-580)', () => {
  it('wins the tiebreak even when the endpoint is CLOSER', () => {
    const at: SnapCandidate = { point: { x: 10, y: 10 }, type: ExtendedSnapType.SELECTED_GRIP, description: 'Selected Grip', distance: 5, priority: SNAP_ENGINE_PRIORITIES.SELECTED_GRIP, entityId: 'hatch-1' };
    const underlying: SnapCandidate = { point: { x: 10, y: 10 }, type: ExtendedSnapType.ENDPOINT, description: 'Endpoint', distance: 0.1, priority: SNAP_ENGINE_PRIORITIES.ENDPOINT, entityId: 'arc-9' };
    const result = new SnapCandidateProcessor().processResults({ x: 10, y: 10 }, [underlying, at], DEFAULT_PRO_SNAP_SETTINGS);
    expect(result.snapPoint?.type).toBe(ExtendedSnapType.SELECTED_GRIP);
    expect(result.snapPoint?.entityId).toBe('hatch-1');
  });
});
