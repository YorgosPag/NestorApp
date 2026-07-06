/**
 * @jest-environment jsdom
 *
 * Tests — ADR-362 Path B: registerUserLinetype + localStorage persistence.
 *
 * jsdom for a real `localStorage`. Persistence hydration runs at MODULE INIT, so
 * the reload path (re-hydrate a fresh registry from storage) is asserted by
 * reading the serialized blob directly rather than re-importing the singleton.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  resolveLinetype,
  listSelectableLinetypeNames,
  registerUserLinetype,
  __resetLinetypeRegistryForTesting,
} from '../LinetypeRegistry';

const LS_KEY = 'dxf:custom-linetypes';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
  localStorage.clear();
});

describe('registerUserLinetype', () => {
  it('registers, tags origin user-created, and exposes it in the picker', () => {
    const def = registerUserLinetype('Δικός μου 1', [5, -2]);
    expect(def).not.toBeNull();
    expect(def?.origin).toBe('user-created');
    expect(def?.id).toMatch(/^ltp_/);
    expect(resolveLinetype('Δικός μου 1')?.pattern).toEqual([5, -2]);
    expect(listSelectableLinetypeNames()).toContain('Δικός μου 1');
  });

  it('trims the name and rejects a duplicate (returns null)', () => {
    expect(registerUserLinetype('  Dupe  ', [5, -2])?.name).toBe('Dupe');
    expect(registerUserLinetype('Dupe', [1, -1])).toBeNull();
  });
});

describe('localStorage persistence', () => {
  it('persists only user-created entries as {name,description,pattern}', () => {
    registerUserLinetype('Persisted', [0, -3], '· · ·');
    const raw = localStorage.getItem(LS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toEqual([{ name: 'Persisted', description: '· · ·', pattern: [0, -3] }]);
  });

  it('reset clears the persisted blob', () => {
    registerUserLinetype('Temp', [4, -4]);
    expect(localStorage.getItem(LS_KEY)).not.toBeNull();
    __resetLinetypeRegistryForTesting();
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });
});
