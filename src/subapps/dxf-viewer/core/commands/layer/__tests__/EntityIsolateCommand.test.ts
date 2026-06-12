/**
 * EntityIsolateCommand tests — ADR-358 §5.6.bis (Revit "Isolate Element").
 *
 * Covers: entity-scope activation (freeze default), undo restores the previous
 * session or clears, redo replays, and the shared LayerUnisolateCommand teardown
 * for an entity-scoped session (no layer snapshot present).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { EntityIsolateCommand } from '../EntityIsolateCommand';
import { LayerUnisolateCommand } from '../LayerUnisolateCommand';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
} from '../../../../systems/isolate/IsolateEffectsStore';
import { __resetLayerStoreForTesting } from '../../../../stores/LayerStore';

beforeEach(() => {
  __resetIsolateEffectsForTesting();
  __resetLayerStoreForTesting();
});

describe('EntityIsolateCommand — execute', () => {
  it('activates an entity-scope freeze session by default', () => {
    new EntityIsolateCommand({ targetEntityIds: ['ent_1', 'ent_2'] }).execute();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.mode).toBe('freeze');
    expect(snap.isolatedLayerIds.size).toBe(0);
    expect(snap.isolatedEntityIds.has('ent_1')).toBe(true);
    expect(snap.isolatedEntityIds.has('ent_2')).toBe(true);
  });

  it('honours an explicit dim mode + opacity + category', () => {
    new EntityIsolateCommand({
      targetEntityIds: ['ent_1'],
      mode: 'dim',
      dimOpacityPercent: 50,
      category: '1 object',
    }).execute();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.mode).toBe('dim');
    expect(snap.dimOpacityPercent).toBe(50);
    expect(snap.category).toBe('1 object');
  });
});

describe('EntityIsolateCommand — undo + redo', () => {
  it('undo clears effects when there was no prior session', () => {
    const cmd = new EntityIsolateCommand({ targetEntityIds: ['ent_1'] });
    cmd.execute();
    cmd.undo();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });

  it('undo restores a prior layer-scope session', () => {
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    const cmd = new EntityIsolateCommand({ targetEntityIds: ['ent_1'] });
    cmd.execute();
    expect(getIsolateEffectsSnapshot().isolatedEntityIds.has('ent_1')).toBe(true);

    cmd.undo();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.isolatedLayerIds.has('lyr_a')).toBe(true);
    expect(snap.isolatedEntityIds.size).toBe(0);
  });

  it('redo re-applies the entity-scope session', () => {
    const cmd = new EntityIsolateCommand({ targetEntityIds: ['ent_1'] });
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getIsolateEffectsSnapshot().isolatedEntityIds.has('ent_1')).toBe(true);
  });

  it('reports affected entity ids', () => {
    const cmd = new EntityIsolateCommand({ targetEntityIds: ['ent_1', 'ent_2'] });
    expect(cmd.getAffectedEntityIds()).toEqual(['ent_1', 'ent_2']);
  });
});

describe('LayerUnisolateCommand — tears down an entity-scope session', () => {
  it('clears effects even with no layer snapshot present', () => {
    new EntityIsolateCommand({ targetEntityIds: ['ent_1'] }).execute();
    expect(getIsolateEffectsSnapshot().active).toBe(true);

    new LayerUnisolateCommand().execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });

  it('undo re-activates the entity-scope session', () => {
    new EntityIsolateCommand({ targetEntityIds: ['ent_1'] }).execute();
    const unisolate = new LayerUnisolateCommand();
    unisolate.execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);

    unisolate.undo();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.isolatedEntityIds.has('ent_1')).toBe(true);
  });
});
