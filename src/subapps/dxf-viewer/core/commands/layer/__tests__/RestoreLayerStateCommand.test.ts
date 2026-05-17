/**
 * RestoreLayerStateCommand tests — ADR-358 §5.9 Q12 Phase 12.
 *
 * Covers: execute applies snapshot + marks current id, undo restores pre-state
 * + previous current id, redo re-applies without re-capturing, unmatched entry
 * reporting, no-op on unknown stateId.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RestoreLayerStateCommand } from '../RestoreLayerStateCommand';
import {
  __resetLayerStoreForTesting,
  getAllLayers,
  setLayers,
} from '../../../../stores/LayerStore';
import {
  __resetLayerStateStoreForTesting,
  getLayerStateStoreSnapshot,
  markCurrentLayerState,
  saveCurrentLayerState,
  setProjectId,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
import {
  createLayerState,
  createLayerStateEntry,
} from '../../../../types/layer-state';
import { saveLayerState } from '../../../../services/layer-state-persistence';

function L(name: string, overrides: Partial<Parameters<typeof createSceneLayer>[0]> = {}) {
  return createSceneLayer({ name, ...overrides });
}

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('execute', () => {
  it('applies snapshot fields + marks currentStateId', () => {
    const layerA = L('A', { visible: true });
    setLayers([layerA]);
    setProjectId('p1');
    // Save baseline (visible=true), then mutate live, then restore.
    const baseline = saveCurrentLayerState({ name: 'baseline' })!;
    // Mutate live store: hide A.
    setLayers([{ ...getAllLayers()[0], visible: false }]);
    expect(getAllLayers()[0].visible).toBe(false);

    new RestoreLayerStateCommand({ stateId: baseline.id }).execute();
    expect(getAllLayers()[0].visible).toBe(true);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(baseline.id);
  });

  it('no-op on unknown stateId', () => {
    setLayers([L('A')]);
    setProjectId('p1');
    new RestoreLayerStateCommand({ stateId: 'lst_missing' }).execute();
    expect(getLayerStateStoreSnapshot().currentStateId).toBeNull();
  });
});

describe('undo', () => {
  it('restores pre-state + previous currentStateId', () => {
    const layerA = L('A', { visible: true });
    setLayers([layerA]);
    setProjectId('p1');
    const stateOn = saveCurrentLayerState({ name: 'on' })!;
    // Make a second state with visible=false.
    setLayers([{ ...getAllLayers()[0], visible: false }]);
    const stateOff = saveCurrentLayerState({ name: 'off' })!;
    // Mark "on" as current first.
    markCurrentLayerState(stateOn.id);
    // Now switch to "off" via the command, then undo.
    const cmd = new RestoreLayerStateCommand({ stateId: stateOff.id });
    cmd.execute();
    expect(getAllLayers()[0].visible).toBe(false);
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(stateOff.id);
    cmd.undo();
    // visible should go back to whatever it was right before execute (= false from setLayers mutation).
    // Pre-state captured AT execute time was visible=false because that's what live store had.
    // currentStateId should revert to stateOn.id.
    expect(getLayerStateStoreSnapshot().currentStateId).toBe(stateOn.id);
  });

  it('snapshot capture happens once, redo skips re-capture', () => {
    setLayers([L('A', { visible: true })]);
    setProjectId('p1');
    const state = saveCurrentLayerState({ name: 's' })!;
    const cmd = new RestoreLayerStateCommand({ stateId: state.id });
    cmd.execute();
    // External mutation between execute and redo.
    setLayers([{ ...getAllLayers()[0], visible: false }]);
    cmd.redo();
    expect(getAllLayers()[0].visible).toBe(true);
    cmd.undo();
    // Undo restores ORIGINAL pre-execute snapshot, not the redo-time state.
    // Original pre-state was visible=true (matched the state itself).
    expect(getAllLayers()[0].visible).toBe(true);
  });
});

describe('unmatched layers', () => {
  it('reports snapshot entries that have no live match', () => {
    // Persist a state into p1 containing a phantom layer "Ghost".
    const phantomState = createLayerState({
      name: 'phantom',
      snapshot: [
        createLayerStateEntry({
          layerId: 'lyr_phantom',
          layerName: 'Ghost',
          visible: false,
          locked: false,
          color: '#000',
        }),
      ],
      createdByUserId: 'u1',
    });
    saveLayerState('p1', phantomState);

    // Hydrate the store from persistence; live scene has only "A".
    setLayers([L('A')]);
    setProjectId('p1');

    const cmd = new RestoreLayerStateCommand({ stateId: phantomState.id });
    cmd.execute();
    expect(cmd.getUnmatchedLayerNames()).toEqual(['Ghost']);
    // Live layer "A" untouched (extra layers as-is policy).
    expect(getAllLayers()[0].name).toBe('A');
  });

  it('matches by case-insensitive layerName when layerId differs', () => {
    const layerA = L('A', { visible: true });
    setLayers([layerA]);
    setProjectId('p1');

    // Build a state whose snapshot has layerId='lst-other' but layerName='a'.
    const state = createLayerState({
      name: 'cross',
      snapshot: [
        createLayerStateEntry({
          layerId: 'lst-other',
          layerName: 'a',
          visible: false,
          locked: false,
          color: '#000',
        }),
      ],
      createdByUserId: 'u1',
    });
    saveLayerState('p1', state);

    const cmd = new RestoreLayerStateCommand({ stateId: state.id });
    cmd.execute();
    expect(cmd.getUnmatchedLayerNames()).toEqual([]);
    expect(getAllLayers()[0].visible).toBe(false);
  });
});

describe('serialize', () => {
  it('serialize round-trips stateId — version 2', () => {
    const cmd = new RestoreLayerStateCommand({ stateId: 'lst_abc' });
    const serialized = cmd.serialize();
    expect(serialized.type).toBe('layer-state-restore');
    expect(serialized.data.stateId).toBe('lst_abc');
    expect(serialized.version).toBe(2);
    expect(serialized.data.options).toEqual({ createMissingLayers: false });
  });

  it('version 2 includes options in data', () => {
    const cmd = new RestoreLayerStateCommand({
      stateId: 'lst_v2',
      options: { createMissingLayers: true },
    });
    const serialized = cmd.serialize();
    expect(serialized.version).toBe(2);
    expect(serialized.data.options).toEqual({ createMissingLayers: true });
  });
});

describe('createMissingLayers option', () => {
  it('createMissing=true creates missing layers and clears unmatched list', () => {
    const ghostState = createLayerState({
      name: 'ghost',
      snapshot: [
        createLayerStateEntry({
          layerId: 'lyr_ghost_cm1',
          layerName: 'GHOST',
          visible: true,
          locked: false,
          color: '#ff0000',
        }),
      ],
      createdByUserId: 'u1',
    });
    saveLayerState('p1', ghostState);
    setLayers([L('A')]);
    setProjectId('p1');

    const cmd = new RestoreLayerStateCommand({
      stateId: ghostState.id,
      options: { createMissingLayers: true },
    });
    cmd.execute();

    expect(cmd.getUnmatchedLayerNames()).toEqual([]);
    const names = getAllLayers().map((l) => l.name);
    expect(names).toContain('GHOST');
  });

  it('undo removes auto-created layers', () => {
    const phantomState = createLayerState({
      name: 'phantom',
      snapshot: [
        createLayerStateEntry({
          layerId: 'lyr_ghost_cm2',
          layerName: 'PHANTOM',
          visible: true,
          locked: false,
          color: '#0000ff',
        }),
      ],
      createdByUserId: 'u1',
    });
    saveLayerState('p1', phantomState);
    setLayers([L('B')]);
    setProjectId('p1');

    const cmd = new RestoreLayerStateCommand({
      stateId: phantomState.id,
      options: { createMissingLayers: true },
    });
    cmd.execute();
    expect(getAllLayers().map((l) => l.name)).toContain('PHANTOM');

    cmd.undo();
    expect(getAllLayers().map((l) => l.name)).not.toContain('PHANTOM');
  });
});
