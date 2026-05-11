/**
 * ADR-344 Phase 6.A — Tests for UpdateTextGeometryCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { UpdateTextGeometryCommand } from '../UpdateTextGeometryCommand';
import { CanEditLayerError } from '../types';
import type { DxfTextSceneEntity } from '../types';
import {
  makeLayerProvider,
  makeNode,
  makeRecorder,
  makeScene,
  makeTextEntity,
} from './test-fixtures';

describe('UpdateTextGeometryCommand', () => {
  it('translates the entity position', () => {
    const { scene, store } = makeScene([makeTextEntity('ent_1')]);
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { position: { x: 10, y: 20 } } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    expect(next.position).toEqual({ x: 10, y: 20 });
  });

  it('rotates the AST', () => {
    const { scene, store } = makeScene([makeTextEntity('ent_1')]);
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { rotation: 45 } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    expect(next.textNode.rotation).toBe(45);
  });

  it('resizes MTEXT column width when columns exist', () => {
    const entity = makeTextEntity('ent_1', {
      textNode: makeNode({ columns: { type: 'static', count: 2, width: 50, gutter: 5 } }),
    });
    const { scene, store } = makeScene([entity]);
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { width: 200 } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    const next = store.get('ent_1') as DxfTextSceneEntity;
    expect(next.textNode.columns!.width).toBe(200);
  });

  it('undo restores the original position, rotation, and node', () => {
    const entity = makeTextEntity('ent_1', { position: { x: 1, y: 2 } });
    const { scene, store } = makeScene([entity]);
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { position: { x: 99, y: 99 }, rotation: 33 } },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    cmd.undo();
    const restored = store.get('ent_1') as DxfTextSceneEntity;
    expect(restored.position).toEqual({ x: 1, y: 2 });
    expect(restored.textNode.rotation).toBe(0);
  });

  it('records one audit entry per execute and merges consecutive geometry patches', () => {
    const { scene } = makeScene([makeTextEntity('ent_1')]);
    const provider = makeLayerProvider({ '0': {} });
    const rec = makeRecorder();
    const a = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { rotation: 10 } },
      scene,
      provider,
      rec,
    );
    const b = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { rotation: 20 } },
      scene,
      provider,
      rec,
    );
    expect(a.canMergeWith(b)).toBe(true);
    const merged = a.mergeWith(b);
    merged.execute();
    expect(rec.events).toHaveLength(1);
  });

  it('blocks on a frozen layer regardless of user capability', () => {
    const entity = makeTextEntity('ent_1', { layer: 'frz' });
    const { scene } = makeScene([entity]);
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'ent_1', patch: { rotation: 5 } },
      scene,
      makeLayerProvider({ frz: { frozen: true } }, true),
    );
    expect(() => cmd.execute()).toThrow(CanEditLayerError);
  });

  it('validate rejects an empty patch', () => {
    const { scene } = makeScene();
    const cmd = new UpdateTextGeometryCommand(
      { entityId: 'x', patch: {} },
      scene,
      makeLayerProvider({}),
    );
    expect(cmd.validate()).toMatch(/patch/);
  });
});
