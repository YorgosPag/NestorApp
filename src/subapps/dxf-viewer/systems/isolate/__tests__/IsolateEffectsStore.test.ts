/**
 * IsolateEffectsStore tests — ADR-358 §5.6.bis Phase 10.
 *
 * Covers: initial inactive state, setIsolateEffects + skip-if-unchanged,
 * clearIsolateEffects, subscribe/unsubscribe.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  __resetIsolateEffectsForTesting,
  clearIsolateEffects,
  getIsolateEffectsSnapshot,
  setIsolateEffects,
  subscribeIsolateEffects,
} from '../IsolateEffectsStore';

beforeEach(() => {
  __resetIsolateEffectsForTesting();
});

describe('IsolateEffectsStore — initial state', () => {
  it('starts inactive', () => {
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(false);
    expect(snap.isolatedLayerIds.size).toBe(0);
    expect(snap.mode).toBe('dim');
    expect(snap.dimOpacityPercent).toBe(30);
    expect(snap.category).toBeNull();
  });

  it('returns stable snapshot reference when idle', () => {
    const a = getIsolateEffectsSnapshot();
    const b = getIsolateEffectsSnapshot();
    expect(a).toBe(b);
  });
});

describe('IsolateEffectsStore — setIsolateEffects', () => {
  it('activates with mode + isolated set + opacity + category', () => {
    setIsolateEffects({
      mode: 'dim',
      isolatedLayerIds: ['lyr_a', 'lyr_b'],
      dimOpacityPercent: 40,
      category: 'architectural',
    });
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(true);
    expect(snap.mode).toBe('dim');
    expect(snap.isolatedLayerIds.has('lyr_a')).toBe(true);
    expect(snap.isolatedLayerIds.has('lyr_b')).toBe(true);
    expect(snap.dimOpacityPercent).toBe(40);
    expect(snap.category).toBe('architectural');
  });

  it('accepts a Set directly (no copy)', () => {
    const set = new Set(['lyr_a']);
    setIsolateEffects({ mode: 'freeze', isolatedLayerIds: set, dimOpacityPercent: 20 });
    expect(getIsolateEffectsSnapshot().isolatedLayerIds).toBe(set);
  });

  it('skip-if-unchanged: identical input does not notify', () => {
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    const listener = jest.fn();
    subscribeIsolateEffects(listener);
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('changing dimOpacity triggers notification', () => {
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    const listener = jest.fn();
    subscribeIsolateEffects(listener);
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 60 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changing isolated layer membership triggers notification', () => {
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    const listener = jest.fn();
    subscribeIsolateEffects(listener);
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_b'], dimOpacityPercent: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('IsolateEffectsStore — clearIsolateEffects', () => {
  it('deactivates and resets to initial', () => {
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 50, category: 'electrical' });
    clearIsolateEffects();
    const snap = getIsolateEffectsSnapshot();
    expect(snap.active).toBe(false);
    expect(snap.isolatedLayerIds.size).toBe(0);
    expect(snap.category).toBeNull();
  });

  it('no-op when already inactive (no notification)', () => {
    const listener = jest.fn();
    subscribeIsolateEffects(listener);
    clearIsolateEffects();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('IsolateEffectsStore — subscribe', () => {
  it('unsubscribe stops notifications', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeIsolateEffects(listener);
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_a'], dimOpacityPercent: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setIsolateEffects({ mode: 'dim', isolatedLayerIds: ['lyr_b'], dimOpacityPercent: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
