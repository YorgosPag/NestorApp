/**
 * CategoryIsolateCommand tests — ADR-358 §5.6.bis (Revit "Isolate Category").
 *
 * Covers: category-scope activation (freeze default), undo restores the prior
 * session or clears, redo replays, and the shared LayerUnisolateCommand teardown.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CategoryIsolateCommand } from '../CategoryIsolateCommand';
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

describe('CategoryIsolateCommand — execute', () => {
  it('activates a category-scope freeze session by default', () => {
    new CategoryIsolateCommand({ targetCategories: ['wall'] }).execute();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.mode).toBe('freeze');
    expect(snap.isolatedLayerIds.size).toBe(0);
    expect(snap.isolatedEntityIds.size).toBe(0);
    expect(snap.isolatedCategories.has('wall')).toBe(true);
  });

  it('supports multiple categories', () => {
    new CategoryIsolateCommand({ targetCategories: ['wall', 'column'] }).execute();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.isolatedCategories.has('wall')).toBe(true);
    expect(snap.isolatedCategories.has('column')).toBe(true);
  });
});

describe('CategoryIsolateCommand — undo + redo', () => {
  it('undo clears effects when there was no prior session', () => {
    const cmd = new CategoryIsolateCommand({ targetCategories: ['wall'] });
    cmd.execute();
    cmd.undo();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });

  it('undo restores a prior entity-scope session', () => {
    setIsolateEffects({ mode: 'freeze', isolatedLayerIds: [], isolatedEntityIds: ['ent_1'], dimOpacityPercent: 30 });
    const cmd = new CategoryIsolateCommand({ targetCategories: ['wall'] });
    cmd.execute();
    expect(getIsolateEffectsSnapshot().isolatedCategories.has('wall')).toBe(true);

    cmd.undo();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.isolatedEntityIds.has('ent_1')).toBe(true);
    expect(snap.isolatedCategories.size).toBe(0);
  });

  it('redo re-applies the category-scope session', () => {
    const cmd = new CategoryIsolateCommand({ targetCategories: ['wall'] });
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(getIsolateEffectsSnapshot().isolatedCategories.has('wall')).toBe(true);
  });
});

describe('LayerUnisolateCommand — tears down a category-scope session', () => {
  it('clears effects even with no layer snapshot present', () => {
    new CategoryIsolateCommand({ targetCategories: ['wall'] }).execute();
    expect(getIsolateEffectsSnapshot().active).toBe(true);

    new LayerUnisolateCommand().execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);
  });

  it('undo re-activates the category-scope session', () => {
    new CategoryIsolateCommand({ targetCategories: ['wall'] }).execute();
    const unisolate = new LayerUnisolateCommand();
    unisolate.execute();
    expect(getIsolateEffectsSnapshot().active).toBe(false);

    unisolate.undo();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.isolatedCategories.has('wall')).toBe(true);
  });
});
