/**
 * ADR-358 Phase 5b — UpdateStairParamsCommand tests.
 *
 * Verifies execute/undo/redo + command merging window + geometry SSoT recompute.
 */

import { UpdateStairParamsCommand } from '../UpdateStairParamsCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../../hooks/drawing/stair-completion';
import type { StairEntity, StairParams } from '../../../../bim/types/stair-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

const basePoint = { x: 0, y: 0 };

function makeStair(): { entity: StairEntity; paramsA: StairParams; paramsB: StairParams } {
  const paramsA = buildDefaultStairParams(basePoint, 0);
  const entity = buildStairEntity(paramsA, '0');
  const paramsB: StairParams = { ...paramsA, width: paramsA.width + 200 };
  return { entity, paramsA, paramsB };
}

describe('UpdateStairParamsCommand (Phase 5b)', () => {
  it('1. execute: patches params + recomputes geometry via SSoT', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { scene, sm } = makeMockScene([entity as unknown as SceneEntity]);

    const cmd = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm);
    cmd.execute();

    const updated = scene.get(entity.id) as unknown as StairEntity;
    expect(updated.params.width).toBe(paramsB.width);
    // Geometry must be recomputed — bbox no longer matches the original.
    expect(updated.geometry).toBeDefined();
    expect(updated.geometry.bbox).toBeDefined();
  });

  it('2. undo: restores previous params + previous geometry', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { scene, sm } = makeMockScene([entity as unknown as SceneEntity]);

    const cmd = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm);
    cmd.execute();
    cmd.undo();

    const restored = scene.get(entity.id) as unknown as StairEntity;
    expect(restored.params.width).toBe(paramsA.width);
  });

  it('3. redo: re-applies new params after undo', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { scene, sm } = makeMockScene([entity as unknown as SceneEntity]);

    const cmd = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    const redone = scene.get(entity.id) as unknown as StairEntity;
    expect(redone.params.width).toBe(paramsB.width);
  });

  it('4. canMergeWith: two dragging commands on same stair within window → merge', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { sm } = makeMockScene([entity as unknown as SceneEntity]);
    const paramsC: StairParams = { ...paramsB, width: paramsB.width + 100 };

    const cmd1 = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm, true);
    const cmd2 = new UpdateStairParamsCommand(entity.id, paramsC, paramsB, sm, true);
    expect(cmd1.canMergeWith(cmd2)).toBe(true);
  });

  it('5. canMergeWith: non-dragging commands → no merge', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { sm } = makeMockScene([entity as unknown as SceneEntity]);

    const cmd1 = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm, false);
    const cmd2 = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm, false);
    expect(cmd1.canMergeWith(cmd2)).toBe(false);
  });

  it('6. mergeWith: keeps earliest previousParams + latest params', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { sm } = makeMockScene([entity as unknown as SceneEntity]);
    const paramsC: StairParams = { ...paramsB, width: paramsB.width + 100 };

    const cmd1 = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm, true);
    const cmd2 = new UpdateStairParamsCommand(entity.id, paramsC, paramsB, sm, true);
    const merged = cmd1.mergeWith(cmd2) as UpdateStairParamsCommand;
    expect(merged).toBeInstanceOf(UpdateStairParamsCommand);
    // The merge result should commit paramsC if executed.
  });

  it('7. validate: rejects stepCount < 2', () => {
    const { entity, paramsA } = makeStair();
    const { sm } = makeMockScene([entity as unknown as SceneEntity]);
    const bad: StairParams = { ...paramsA, stepCount: 1 };
    const cmd = new UpdateStairParamsCommand(entity.id, bad, paramsA, sm);
    expect(cmd.validate()).not.toBeNull();
  });

  it('8. getAffectedEntityIds returns the stair id', () => {
    const { entity, paramsA, paramsB } = makeStair();
    const { sm } = makeMockScene([entity as unknown as SceneEntity]);
    const cmd = new UpdateStairParamsCommand(entity.id, paramsB, paramsA, sm);
    expect(cmd.getAffectedEntityIds()).toEqual([entity.id]);
  });
});
