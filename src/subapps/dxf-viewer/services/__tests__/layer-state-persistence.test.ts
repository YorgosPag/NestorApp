/**
 * layer-state-persistence tests — ADR-358 §5.9 Q12 Phase 12.
 *
 * Covers: race-free initial hydrate, save/delete/replace round-trip, malformed
 * entry rejection, multi-project isolation, SSR safety.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  __resetLayerStatePersistenceForTesting,
  deleteLayerState,
  readProjectLayerStates,
  replaceProjectLayerStates,
  saveLayerState,
  subscribeProjectLayerStates,
} from '../layer-state-persistence';
import { createLayerState, createLayerStateEntry } from '../../types/layer-state';

function makeState(name: string, id?: string) {
  return createLayerState({
    id,
    name,
    snapshot: [
      createLayerStateEntry({
        layerId: 'lyr_1',
        layerName: 'A',
        visible: true,
        locked: false,
        color: '#fff',
      }),
    ],
    createdByUserId: 'u1',
  });
}

beforeEach(() => {
  __resetLayerStatePersistenceForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('save + read', () => {
  it('round-trips a single state', () => {
    const s = makeState('s1');
    saveLayerState('p1', s);
    const read = readProjectLayerStates('p1');
    expect(read).toHaveLength(1);
    expect(read[0].id).toBe(s.id);
    expect(read[0].snapshot).toHaveLength(1);
  });

  it('upsert replaces by id', () => {
    const s = makeState('s1', 'lst_fixed');
    saveLayerState('p1', s);
    const s2 = createLayerState({ ...s, name: 's1-renamed' });
    saveLayerState('p1', s2);
    expect(readProjectLayerStates('p1')).toHaveLength(1);
    expect(readProjectLayerStates('p1')[0].name).toBe('s1-renamed');
  });
});

describe('delete', () => {
  it('removes by id', () => {
    const s = makeState('s1');
    saveLayerState('p1', s);
    deleteLayerState('p1', s.id);
    expect(readProjectLayerStates('p1')).toEqual([]);
  });

  it('no-op on unknown id', () => {
    const s = makeState('s1');
    saveLayerState('p1', s);
    deleteLayerState('p1', 'missing');
    expect(readProjectLayerStates('p1')).toHaveLength(1);
  });
});

describe('replace', () => {
  it('overwrites the list atomically', () => {
    saveLayerState('p1', makeState('s1'));
    saveLayerState('p1', makeState('s2'));
    replaceProjectLayerStates('p1', [makeState('only')]);
    const read = readProjectLayerStates('p1');
    expect(read).toHaveLength(1);
    expect(read[0].name).toBe('only');
  });
});

describe('subscribe', () => {
  it('fires immediate hydrate snapshot', () => {
    const s = makeState('s1');
    saveLayerState('p1', s);
    const received: number[] = [];
    const handle = subscribeProjectLayerStates('p1', (list) => {
      received.push(list.length);
    });
    expect(received).toEqual([1]);
    handle.unsubscribe();
  });

  it('emits on save/delete/replace', () => {
    const received: number[] = [];
    const handle = subscribeProjectLayerStates('p1', (list) => {
      received.push(list.length);
    });
    saveLayerState('p1', makeState('s1'));
    saveLayerState('p1', makeState('s2'));
    deleteLayerState('p1', readProjectLayerStates('p1')[0].id);
    replaceProjectLayerStates('p1', []);
    expect(received).toEqual([0, 1, 2, 1, 0]);
    handle.unsubscribe();
  });

  it('unsubscribe is idempotent', () => {
    const handle = subscribeProjectLayerStates('p1', () => {});
    handle.unsubscribe();
    expect(() => handle.unsubscribe()).not.toThrow();
  });
});

describe('isolation', () => {
  it('per-project storage keys', () => {
    saveLayerState('p1', makeState('s-p1'));
    saveLayerState('p2', makeState('s-p2'));
    expect(readProjectLayerStates('p1').map((s) => s.name)).toEqual(['s-p1']);
    expect(readProjectLayerStates('p2').map((s) => s.name)).toEqual(['s-p2']);
  });

  it('empty projectId is no-op', () => {
    saveLayerState('', makeState('s1'));
    expect(readProjectLayerStates('')).toEqual([]);
  });
});

describe('defensive read', () => {
  it('drops malformed entries silently', () => {
    window.localStorage.setItem(
      'dxf:layerStates:p1',
      JSON.stringify([{ id: 'lst_1', name: 'ok', snapshot: [], createdAt: 't', updatedAt: 't' }, { broken: true }]),
    );
    const read = readProjectLayerStates('p1');
    expect(read).toHaveLength(1);
    expect(read[0].name).toBe('ok');
  });

  it('returns [] on non-array JSON', () => {
    window.localStorage.setItem('dxf:layerStates:p1', JSON.stringify({ not: 'array' }));
    expect(readProjectLayerStates('p1')).toEqual([]);
  });

  it('returns [] on invalid JSON', () => {
    window.localStorage.setItem('dxf:layerStates:p1', '{not-json');
    expect(readProjectLayerStates('p1')).toEqual([]);
  });
});
