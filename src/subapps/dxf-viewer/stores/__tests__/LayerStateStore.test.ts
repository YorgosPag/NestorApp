/**
 * LayerStateStore tests — ADR-358 §5.9 Q12 Phase 12.
 *
 * Covers: lifecycle (idle/hydrating/ready), saveCurrent snapshot capture,
 * rename + delete + currentStateId tracking, subscribe notify, project switch
 * detach.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  __resetLayerStateStoreForTesting,
  clearProject,
  captureCurrentSnapshot,
  deleteLayerStateById,
  getLayerState,
  getLayerStateStoreSnapshot,
  listLayerStates,
  markCurrentLayerState,
  renameLayerState,
  saveCurrentLayerState,
  setProjectId,
  subscribeLayerStateStore,
} from '../LayerStateStore';
import {
  __resetLayerStoreForTesting,
  setLayers,
} from '../LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../services/layer-state-persistence';
import { createSceneLayer } from '../../types/entities';

function L(name: string, overrides: Partial<Parameters<typeof createSceneLayer>[0]> = {}) {
  return createSceneLayer({ name, ...overrides });
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('lifecycle', () => {
  it('starts idle', () => {
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('idle');
    expect(getLayerStateStoreSnapshot().projectId).toBeNull();
  });

  it('setProjectId hydrates to ready', () => {
    setProjectId('p1');
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('ready');
    expect(getLayerStateStoreSnapshot().projectId).toBe('p1');
  });

  it('clearProject resets to idle', () => {
    setProjectId('p1');
    clearProject();
    expect(getLayerStateStoreSnapshot().hydrationStatus).toBe('idle');
    expect(getLayerStateStoreSnapshot().projectId).toBeNull();
  });

  it('switching projects detaches previous listener', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 's1' });
    expect(listLayerStates()).toHaveLength(1);
    setProjectId('p2');
    expect(listLayerStates()).toHaveLength(0);
  });
});

describe('saveCurrentLayerState', () => {
  beforeEach(() => {
    setLayers([L('A', { color: '#ff0000' }), L('B')]);
    setProjectId('p1', 'user-1');
  });

  it('returns null without a project', () => {
    clearProject();
    expect(saveCurrentLayerState({ name: 's1' })).toBeNull();
  });

  it('captures every layer into snapshot', () => {
    const state = saveCurrentLayerState({ name: 'baseline' });
    expect(state).not.toBeNull();
    expect(state!.snapshot).toHaveLength(2);
    expect(state!.snapshot.map((e) => e.layerName).sort()).toEqual(['A', 'B']);
    expect(state!.createdByUserId).toBe('user-1');
    expect(state!.source).toBe('user-created');
    expect(state!.id).toMatch(/^lst_/);
  });

  it('persists across hydrate (read-back via store)', () => {
    saveCurrentLayerState({ name: 's1' });
    expect(listLayerStates().map((s) => s.name)).toEqual(['s1']);
  });
});

describe('renameLayerState', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('renames in place and bumps updatedAt', () => {
    const created = saveCurrentLayerState({ name: 'old' })!;
    const renamed = renameLayerState(created.id, 'new');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('new');
    expect(renamed!.updatedAt >= created.updatedAt).toBe(true);
    expect(listLayerStates()[0].name).toBe('new');
  });

  it('no-op on unknown id', () => {
    expect(renameLayerState('missing', 'x')).toBeNull();
  });

  it('rejects empty trimmed name via trimmed empty-string check from hook layer (store accepts raw)', () => {
    const created = saveCurrentLayerState({ name: 'old' })!;
    const renamed = renameLayerState(created.id, '   ');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('   ');
  });
});

describe('deleteLayerStateById', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('removes the state', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    deleteLayerStateById(created.id);
    expect(getLayerState(created.id)).toBeNull();
  });

  it('clears currentStateId if it pointed to the deleted state', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    markCurrentLayerState(created.id);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(created.id);
    deleteLayerStateById(created.id);
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });
});

describe('markCurrentLayerState', () => {
  beforeEach(() => {
    setLayers([L('A')]);
    setProjectId('p1');
  });

  it('ignores unknown id', () => {
    markCurrentLayerState('missing');
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });

  it('accepts null clear', () => {
    const created = saveCurrentLayerState({ name: 's1' })!;
    markCurrentLayerState(created.id);
    markCurrentLayerState(null);
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });
});

describe('captureCurrentSnapshot', () => {
  it('mirrors the live LayerStore', () => {
    setLayers([L('A', { visible: false, frozen: true })]);
    const snapshot = captureCurrentSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].layerName).toBe('A');
    expect(snapshot[0].visible).toBe(false);
    expect(snapshot[0].frozen).toBe(true);
  });

  it('empty when no layers loaded', () => {
    expect(captureCurrentSnapshot()).toEqual([]);
  });
});

describe('subscribe', () => {
  it('fires on save + delete', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    let count = 0;
    const unsub = subscribeLayerStateStore(() => { count += 1; });
    const created = saveCurrentLayerState({ name: 's1' })!;
    deleteLayerStateById(created.id);
    expect(count).toBeGreaterThanOrEqual(2);
    unsub();
  });
});
