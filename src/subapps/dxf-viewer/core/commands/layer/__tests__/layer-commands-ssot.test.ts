/**
 * ADR-616 — Layer command SSoT parity tests.
 *
 * Verifies the migrated layer commands (BaseCommand + LayerCommandBase +
 * SingleLayerFlagCommand / MutateAllLayersCommand / IsolateEffectsCommand /
 * DelegatingLayerCommand) keep their execute / undo / redo / serialize /
 * id-format / affected-ids contract against a real LayerStore +
 * IsolateEffectsStore. Complements the per-command behaviour suites.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LayerFreezeCommand } from '../LayerFreezeCommand';
import { LayerLockCommand } from '../LayerLockCommand';
import { LayerOnAllCommand } from '../LayerOnAllCommand';
import { EntityIsolateCommand } from '../EntityIsolateCommand';
import { LayerDimCommand } from '../LayerDimCommand';
import {
  __resetLayerStoreForTesting,
  setLayers,
  getLayer,
} from '../../../../stores/LayerStore';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
} from '../../../../systems/isolate/IsolateEffectsStore';
import { createSceneLayer } from '../../../../types/entities';

beforeEach(() => {
  __resetIsolateEffectsForTesting();
  __resetLayerStoreForTesting();
});

const seedLayer = (over: Partial<Parameters<typeof createSceneLayer>[0]> = {}) =>
  setLayers([createSceneLayer({ id: 'lyr_a', name: 'A', visible: true, ...over })]);

describe('ADR-616 layer command SSoT', () => {
  describe('BaseCommand envelope + injected id (makeLayerCommandKey)', () => {
    it('mints a prefixed history key and a well-formed serialize envelope', () => {
      const cmd = new LayerFreezeCommand({ layerId: 'lyr_a' });
      expect(cmd.id.startsWith('layer-freeze-')).toBe(true);
      expect(typeof cmd.timestamp).toBe('number');
      expect(cmd.getAffectedEntityIds()).toEqual([]);

      const s = cmd.serialize();
      expect(s).toMatchObject({
        type: 'layer-freeze',
        id: cmd.id,
        name: 'LayerFreeze',
        version: 1,
      });
      expect(s.data).toEqual({ layerId: 'lyr_a' });
    });
  });

  describe('SingleLayerFlagCommand lifecycle', () => {
    it('Freeze sets frozen, undo restores, redo re-applies', () => {
      seedLayer({ frozen: false });
      const cmd = new LayerFreezeCommand({ layerId: 'lyr_a' });
      cmd.execute();
      expect(getLayer('lyr_a')?.frozen).toBe(true);
      cmd.undo();
      expect(getLayer('lyr_a')?.frozen).toBe(false);
      cmd.redo();
      expect(getLayer('lyr_a')?.frozen).toBe(true);
    });

    it('Lock drives the locked flag (distinct from freeze)', () => {
      seedLayer({ locked: false });
      const cmd = new LayerLockCommand({ layerId: 'lyr_a' });
      cmd.execute();
      expect(getLayer('lyr_a')?.locked).toBe(true);
      expect(getLayer('lyr_a')?.frozen ?? false).toBe(false);
    });

    it('no-ops (undo inert) when the layer is already at the target value', () => {
      seedLayer({ frozen: true });
      const cmd = new LayerFreezeCommand({ layerId: 'lyr_a' });
      cmd.execute();
      cmd.undo();
      expect(getLayer('lyr_a')?.frozen).toBe(true);
    });
  });

  describe('MutateAllLayersCommand', () => {
    it('OnAll turns on every invisible layer; undo restores', () => {
      setLayers([
        createSceneLayer({ id: 'lyr_a', name: 'A', visible: false }),
        createSceneLayer({ id: 'lyr_b', name: 'B', visible: true }),
      ]);
      const cmd = new LayerOnAllCommand();
      cmd.execute();
      expect(getLayer('lyr_a')?.visible).toBe(true);
      expect(getLayer('lyr_b')?.visible).toBe(true);
      cmd.undo();
      expect(getLayer('lyr_a')?.visible).toBe(false);
    });
  });

  describe('IsolateEffectsCommand', () => {
    it('EntityIsolate applies effects + reports affected ids; undo clears', () => {
      const cmd = new EntityIsolateCommand({ targetEntityIds: ['ent_1', 'ent_2'] });
      expect(cmd.getAffectedEntityIds()).toEqual(['ent_1', 'ent_2']);
      cmd.execute();
      const snap = getIsolateEffectsSnapshot();
      expect(snap.active).toBe(true);
      expect(snap.isolatedEntityIds.has('ent_1')).toBe(true);
      cmd.undo();
      expect(getIsolateEffectsSnapshot().active).toBe(false);
    });
  });

  describe('DelegatingLayerCommand', () => {
    it('LayerDim delegates the whole lifecycle to an inner isolate', () => {
      seedLayer();
      const cmd = new LayerDimCommand({ targetLayerIds: ['lyr_a'], dimOpacityPercent: 40 });
      cmd.execute();
      const snap = getIsolateEffectsSnapshot();
      expect(snap.active).toBe(true);
      expect(snap.mode).toBe('dim');
      cmd.undo();
      expect(getIsolateEffectsSnapshot().active).toBe(false);
    });
  });
});
