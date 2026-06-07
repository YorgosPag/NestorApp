/**
 * ADR-421 SLICE C — `opening-boq-side-effects` tests.
 *
 * Verifies the pure cross-floor opening BOQ re-feed fan-out:
 *   - one recompute per building floor, with `floorplanId = level.sceneFileId`
 *     and that floor's `floorId` stamped on the BOQ context,
 *   - a level without `sceneFileId` is skipped (stale until loaded, no recompute),
 *   - an incomplete BOQ context (no company/project/building) is a no-op,
 *   - a per-floor failure does not abort the remaining floors.
 */

import { refeedOpeningBoqForTypeAcrossFloors } from '../opening-boq-side-effects';
import type { FloorLevelLike } from '../family-type-side-effects';
import type { OpeningBoqContext } from '../../services/opening-boq-sync';

const BASE = { companyId: 'co-1', projectId: 'pr-1', buildingId: 'bl-1' };

interface RecomputeCall {
  context: OpeningBoqContext;
  typeId: string;
}

function makeRecomputeSpy() {
  const calls: RecomputeCall[] = [];
  const recompute = (context: OpeningBoqContext, typeId: string): Promise<void> => {
    calls.push({ context, typeId });
    return Promise.resolve();
  };
  return { calls, recompute };
}

describe('refeedOpeningBoqForTypeAcrossFloors (ADR-421 SLICE C)', () => {
  it('recomputes once per floor, floorplanId = sceneFileId, tagging floorId', async () => {
    const levels: FloorLevelLike[] = [
      { id: 'lvl-1', floorId: 'flr-1', sceneFileId: 'scene-1' },
      { id: 'lvl-2', floorId: 'flr-2', sceneFileId: 'scene-2' },
    ];
    const { calls, recompute } = makeRecomputeSpy();

    await refeedOpeningBoqForTypeAcrossFloors({ typeId: 'T1', levels, boqContextBase: BASE, recompute });

    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.typeId === 'T1')).toBe(true);
    const byFloorplan = new Map(calls.map((c) => [c.context.floorplanId, c.context]));
    expect(byFloorplan.get('scene-1')).toEqual({ ...BASE, floorplanId: 'scene-1', floorId: 'flr-1' });
    expect(byFloorplan.get('scene-2')).toEqual({ ...BASE, floorplanId: 'scene-2', floorId: 'flr-2' });
  });

  it('skips a level without sceneFileId (no recompute for it)', async () => {
    const levels: FloorLevelLike[] = [
      { id: 'lvl-1', floorId: 'flr-1', sceneFileId: 'scene-1' },
      { id: 'lvl-fileless', floorId: 'flr-2' }, // no sceneFileId
    ];
    const { calls, recompute } = makeRecomputeSpy();

    await refeedOpeningBoqForTypeAcrossFloors({ typeId: 'T1', levels, boqContextBase: BASE, recompute });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.context.floorplanId).toBe('scene-1');
  });

  it('no-op when BOQ context is incomplete', async () => {
    const { calls, recompute } = makeRecomputeSpy();
    await refeedOpeningBoqForTypeAcrossFloors({
      typeId: 'T1',
      levels: [{ id: 'lvl-1', floorId: 'flr-1', sceneFileId: 'scene-1' }],
      boqContextBase: { companyId: '', projectId: 'pr-1', buildingId: 'bl-1' },
      recompute,
    });
    expect(calls).toHaveLength(0);
  });

  it('a per-floor failure is isolated — remaining floors still recompute', async () => {
    const levels: FloorLevelLike[] = [
      { id: 'lvl-1', floorId: 'flr-1', sceneFileId: 'scene-1' },
      { id: 'lvl-2', floorId: 'flr-2', sceneFileId: 'scene-2' },
    ];
    const seen: string[] = [];
    const recompute = (context: OpeningBoqContext): Promise<void> => {
      seen.push(context.floorplanId);
      return context.floorplanId === 'scene-1'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve();
    };

    await refeedOpeningBoqForTypeAcrossFloors({ typeId: 'T1', levels, boqContextBase: BASE, recompute });

    expect(seen).toEqual(['scene-1', 'scene-2']);
  });
});
