/**
 * ADR-363 Phase 5.5a — `UpdateBeamParamsCommand` tests.
 *
 * Verifies:
 *   - execute / undo / redo round-trip patches params + recomputes geometry
 *     + validation atomically (kind synced at root level)
 *   - merge window (ADR-031): consecutive drag samples within the time
 *     window collapse via `canMergeWith` / `mergeWith`
 *   - validator rejects empty IDs / non-positive dimensions / degenerate axis /
 *     curved kind χωρίς curveControl
 *   - serialize round-trips key fields
 */

import { UpdateBeamParamsCommand } from '../UpdateBeamParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildDefaultBeamParams,
  buildBeamEntity,
} from '../../../../hooks/drawing/beam-completion';
import type { BeamEntity, BeamParams } from '../../../../bim/types/beam-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

function makeStraightBeam(): BeamEntity {
  const params = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
  const r = buildBeamEntity(params, '0');
  if (!r.ok) throw new Error('beam build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

function makeCurvedBeam(): BeamEntity {
  const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'curved');
  const params: BeamParams = {
    ...base,
    kind: 'curved',
    curveControl: { x: 2000, y: 800, z: 0 },
  };
  const r = buildBeamEntity(params, '0');
  if (!r.ok) throw new Error('curved beam build failed: ' + r.hardErrors.join(','));
  return r.entity;
}

describe('UpdateBeamParamsCommand (Phase 5.5a)', () => {
  it('1. execute: patches params + recomputes geometry + validation', () => {
    const beam = makeStraightBeam();
    const { scene, sm } = makeMockScene([beam as unknown as SceneEntity]);
    const paramsB: BeamParams = { ...beam.params, width: 400 };

    const cmd = new UpdateBeamParamsCommand(beam.id, paramsB, beam.params, sm);
    cmd.execute();

    const updated = scene.get(beam.id) as unknown as BeamEntity;
    expect(updated.params.width).toBe(400);
    // Geometry recomputed: outline rectangle width changed → area = length × width.
    // length = 4m, width = 0.4m → area = 1.6 m².
    expect(updated.geometry.area).toBeCloseTo(1.6, 3);
    expect(updated.validation).toBeDefined();
  });

  it('2. execute: syncs root kind with params.kind', () => {
    const beam = makeStraightBeam();
    const { scene, sm } = makeMockScene([beam as unknown as SceneEntity]);
    const paramsB: BeamParams = { ...beam.params, kind: 'cantilever', supportType: 'cantilever' };

    const cmd = new UpdateBeamParamsCommand(beam.id, paramsB, beam.params, sm);
    cmd.execute();

    const updated = scene.get(beam.id) as unknown as BeamEntity;
    expect(updated.kind).toBe('cantilever');
    expect(updated.params.kind).toBe('cantilever');
  });

  it('3. undo: restores previous params + geometry', () => {
    const beam = makeStraightBeam();
    const { scene, sm } = makeMockScene([beam as unknown as SceneEntity]);
    const paramsB: BeamParams = { ...beam.params, depth: 700 };

    const cmd = new UpdateBeamParamsCommand(beam.id, paramsB, beam.params, sm);
    cmd.execute();
    cmd.undo();

    const reverted = scene.get(beam.id) as unknown as BeamEntity;
    expect(reverted.params.depth).toBe(beam.params.depth);
    expect(reverted.geometry.volume).toBeCloseTo(beam.geometry.volume, 6);
  });

  it('4. redo: re-applies after undo', () => {
    const beam = makeStraightBeam();
    const { scene, sm } = makeMockScene([beam as unknown as SceneEntity]);
    const paramsB: BeamParams = { ...beam.params, depth: 700 };

    const cmd = new UpdateBeamParamsCommand(beam.id, paramsB, beam.params, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const updated = scene.get(beam.id) as unknown as BeamEntity;
    expect(updated.params.depth).toBe(700);
  });

  it('5. undo before execute is a no-op', () => {
    const beam = makeStraightBeam();
    const { scene, sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(
      beam.id,
      { ...beam.params, depth: 999 },
      beam.params,
      sm,
    );
    cmd.undo();
    const e = scene.get(beam.id) as unknown as BeamEntity;
    expect(e.params.depth).toBe(beam.params.depth);
  });

  it('6. canMergeWith: same beam, both dragging, within window', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);

    const cmd1 = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, true);
    const cmd2 = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);

    const merged = cmd1.mergeWith(cmd2) as UpdateBeamParamsCommand;
    expect(merged).toBeInstanceOf(UpdateBeamParamsCommand);
    expect(merged.getAffectedEntityIds()).toEqual([beam.id]);
  });

  it('7. canMergeWith: false when isDragging=false on either side', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmdA = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, false);
    const cmdB = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
    expect(cmdB.canMergeWith(cmdA)).toBe(false);
  });

  it('8. canMergeWith: false across different beams', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmdA = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, true);
    const cmdB = new UpdateBeamParamsCommand('beam_other', beam.params, beam.params, sm, true);
    expect(cmdA.canMergeWith(cmdB)).toBe(false);
  });

  it('9. validate rejects empty entity id', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand('', beam.params, beam.params, sm);
    expect(cmd.validate()).toMatch(/Beam entity ID/);
  });

  it('10. validate rejects non-positive width', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(
      beam.id,
      { ...beam.params, width: 0 },
      beam.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/width/);
  });

  it('11. validate rejects non-positive depth', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(
      beam.id,
      { ...beam.params, depth: 0 },
      beam.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/depth/);
  });

  it('12. validate rejects degenerate axis (start ≡ end)', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(
      beam.id,
      { ...beam.params, endPoint: { ...beam.params.startPoint } },
      beam.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/length/);
  });

  it('13. validate rejects curved kind without curveControl', () => {
    const beam = makeCurvedBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(
      beam.id,
      { ...beam.params, curveControl: undefined },
      beam.params,
      sm,
    );
    expect(cmd.validate()).toMatch(/curveControl/);
  });

  it('14. serialize: round-trips key fields', () => {
    const beam = makeStraightBeam();
    const { sm } = makeMockScene([beam as unknown as SceneEntity]);
    const cmd = new UpdateBeamParamsCommand(beam.id, beam.params, beam.params, sm, true);
    const s = cmd.serialize();
    expect(s.type).toBe('update-beam-params');
    expect(s.data).toMatchObject({ entityId: beam.id, isDragging: true });
  });
});
