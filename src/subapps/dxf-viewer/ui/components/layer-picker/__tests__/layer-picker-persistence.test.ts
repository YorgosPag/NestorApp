/**
 * layer-picker-persistence pure-fn tests — ADR-358 Phase 7 §5.5.bis Q8.
 *
 * Covers localStorage read/write + Firestore-slice merge helpers.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  currentLayerStorageKey,
  recentLayersStorageKey,
  readCurrentLayerLocal,
  readRecentLayersLocal,
  writeCurrentLayerLocal,
  writeRecentLayersLocal,
  mergeCurrentLayerIntoSlice,
  mergeRecentIntoSlice,
  pickCurrentFromSlice,
  pickRecentFromSlice,
  type LayerPickerFirestoreSlice,
} from '../layer-picker-persistence';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('layer-picker-persistence — storage keys', () => {
  it('builds deterministic per-project + per-level current keys', () => {
    expect(currentLayerStorageKey('proj_1', 'lvl_a')).toBe('dxf:currentLayer:proj_1:lvl_a');
  });
  it('builds deterministic per-project recent keys', () => {
    expect(recentLayersStorageKey('proj_1')).toBe('dxf:recentLayers:proj_1');
  });
});

describe('layer-picker-persistence — localStorage round-trip', () => {
  it('returns null for missing current entry', () => {
    expect(readCurrentLayerLocal('proj_1', 'lvl_a')).toBeNull();
  });

  it('writes + reads current layer id', () => {
    writeCurrentLayerLocal('proj_1', 'lvl_a', 'lyr_walls');
    expect(readCurrentLayerLocal('proj_1', 'lvl_a')).toBe('lyr_walls');
  });

  it('writing null clears the entry', () => {
    writeCurrentLayerLocal('proj_1', 'lvl_a', 'lyr_walls');
    writeCurrentLayerLocal('proj_1', 'lvl_a', null);
    expect(readCurrentLayerLocal('proj_1', 'lvl_a')).toBeNull();
  });

  it('writes + reads recent layers as JSON', () => {
    writeRecentLayersLocal('proj_1', ['lyr_a', 'lyr_b', 'lyr_c']);
    expect(readRecentLayersLocal('proj_1')).toEqual(['lyr_a', 'lyr_b', 'lyr_c']);
  });

  it('caps recent on read (defensive against tampered storage)', () => {
    const long = Array.from({ length: 25 }, (_, i) => `lyr_${i}`);
    window.localStorage.setItem('dxf:recentLayers:proj_1', JSON.stringify(long));
    expect(readRecentLayersLocal('proj_1')).toHaveLength(10);
  });

  it('returns [] on malformed JSON', () => {
    window.localStorage.setItem('dxf:recentLayers:proj_1', '{not json');
    expect(readRecentLayersLocal('proj_1')).toEqual([]);
  });

  it('drops non-string entries from recent payload', () => {
    window.localStorage.setItem(
      'dxf:recentLayers:proj_1',
      JSON.stringify(['ok', 42, null, 'also-ok']),
    );
    expect(readRecentLayersLocal('proj_1')).toEqual(['ok', 'also-ok']);
  });

  it('no-ops when projectId/levelId is empty', () => {
    writeCurrentLayerLocal('', 'lvl_a', 'lyr_x');
    expect(readCurrentLayerLocal('', 'lvl_a')).toBeNull();
    writeRecentLayersLocal('', ['lyr_a']);
    expect(readRecentLayersLocal('')).toEqual([]);
  });
});

describe('layer-picker-persistence — Firestore slice merges', () => {
  const emptySlice: LayerPickerFirestoreSlice = {};

  it('inserts current layer into empty slice', () => {
    const next = mergeCurrentLayerIntoSlice(emptySlice, 'p1', 'l1', 'lyr_w');
    expect(next.currentByLevel).toEqual({ p1: { l1: 'lyr_w' } });
  });

  it('overwrites existing level entry', () => {
    const slice = { currentByLevel: { p1: { l1: 'lyr_old' } } };
    const next = mergeCurrentLayerIntoSlice(slice, 'p1', 'l1', 'lyr_new');
    expect(next.currentByLevel?.p1.l1).toBe('lyr_new');
  });

  it('null layer prunes level + empty project', () => {
    const slice = { currentByLevel: { p1: { l1: 'lyr_w' } } };
    const next = mergeCurrentLayerIntoSlice(slice, 'p1', 'l1', null);
    expect(next.currentByLevel?.p1).toBeUndefined();
  });

  it('keeps other projects untouched', () => {
    const slice = { currentByLevel: { p1: { l1: 'a' }, p2: { l1: 'b' } } };
    const next = mergeCurrentLayerIntoSlice(slice, 'p1', 'l2', 'c');
    expect(next.currentByLevel?.p2.l1).toBe('b');
    expect(next.currentByLevel?.p1).toEqual({ l1: 'a', l2: 'c' });
  });

  it('merges recent list per project + caps at 10', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `lyr_${i}`);
    const next = mergeRecentIntoSlice(emptySlice, 'p1', ids);
    expect(next.recentByProject?.p1).toHaveLength(10);
  });

  it('empty recent list prunes the project entry', () => {
    const slice = { recentByProject: { p1: ['a', 'b'], p2: ['c'] } };
    const next = mergeRecentIntoSlice(slice, 'p1', []);
    expect(next.recentByProject?.p1).toBeUndefined();
    expect(next.recentByProject?.p2).toEqual(['c']);
  });

  it('pickCurrentFromSlice returns null when slice missing', () => {
    expect(pickCurrentFromSlice(undefined, 'p1', 'l1')).toBeNull();
    expect(pickCurrentFromSlice({}, 'p1', 'l1')).toBeNull();
  });

  it('pickRecentFromSlice returns [] when slice missing', () => {
    expect(pickRecentFromSlice(undefined, 'p1')).toEqual([]);
    expect(pickRecentFromSlice({}, 'p1')).toEqual([]);
  });
});
