/**
 * ADR-344 Phase 6.A — Tests for DeleteTextCommand.
 */

import { describe, it, expect } from '@jest/globals';
import { DeleteTextCommand } from '../DeleteTextCommand';
import { CanEditLayerError } from '../types';
import {
  makeLayerProvider,
  makeRecorder,
  makeScene,
  makeTextEntity,
} from './test-fixtures';

describe('DeleteTextCommand', () => {
  it('removes the entity from the scene on execute', () => {
    const { scene, store } = makeScene([makeTextEntity('ent_1')]);
    const cmd = new DeleteTextCommand(
      { entityId: 'ent_1' },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    expect(store.has('ent_1')).toBe(false);
  });

  it('undo restores the original entity', () => {
    const entity = makeTextEntity('ent_1');
    const { scene, store } = makeScene([entity]);
    const cmd = new DeleteTextCommand(
      { entityId: 'ent_1' },
      scene,
      makeLayerProvider({ '0': {} }),
    );
    cmd.execute();
    cmd.undo();
    expect(store.get('ent_1')).toBe(entity);
  });

  it('records "deleted" on execute and "created" on undo', () => {
    const rec = makeRecorder();
    const { scene } = makeScene([makeTextEntity('ent_1')]);
    const cmd = new DeleteTextCommand(
      { entityId: 'ent_1' },
      scene,
      makeLayerProvider({ '0': {} }),
      rec,
    );
    cmd.execute();
    cmd.undo();
    expect(rec.events.map((e) => e.action)).toEqual(['deleted', 'created']);
  });

  it('blocks on a locked layer when the user cannot unlock', () => {
    const { scene } = makeScene([makeTextEntity('ent_1', { layer: 'lock' })]);
    const cmd = new DeleteTextCommand(
      { entityId: 'ent_1' },
      scene,
      makeLayerProvider({ lock: { locked: true } }, false),
    );
    expect(() => cmd.execute()).toThrow(CanEditLayerError);
  });

  it('no-ops on a missing entity (idempotent on edge case)', () => {
    const { scene } = makeScene();
    const cmd = new DeleteTextCommand(
      { entityId: 'ghost' },
      scene,
      makeLayerProvider({}),
    );
    expect(() => cmd.execute()).not.toThrow();
  });
});
