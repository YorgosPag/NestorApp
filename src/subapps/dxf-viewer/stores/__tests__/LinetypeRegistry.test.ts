/**
 * LinetypeRegistry contract tests — ADR-358 Phase 2A.
 *
 * Covers the singleton micro-leaf API surface:
 *   - ISO baseline pre-loaded at construction (8 entries, canonical order)
 *   - resolve(name) hits ISO baseline and runtime registrations
 *   - registerLinetype dedup on name (case-sensitive)
 *   - registerLinetypes batch atomic notify
 *   - subscribe fires on change, skip-if-noop
 *   - __resetForTesting restores ISO baseline only
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getLinetypeRegistrySnapshot,
  subscribeLinetypeRegistry,
  resolveLinetype,
  listLinetypes,
  registerLinetype,
  registerLinetypes,
  __resetLinetypeRegistryForTesting,
} from '../LinetypeRegistry';
import {
  LINETYPE_ISO_NAMES,
  type LinetypeDef,
} from '../../config/linetype-iso-catalog';

beforeEach(() => {
  __resetLinetypeRegistryForTesting();
});

describe('LinetypeRegistry — ISO baseline pre-load', () => {
  it('starts with all 8 ISO baseline linetypes in canonical order', () => {
    const snap = getLinetypeRegistrySnapshot();
    expect(snap.linetypes).toHaveLength(8);
    expect(snap.linetypes.map((d) => d.name)).toEqual([...LINETYPE_ISO_NAMES]);
  });

  it('marks every baseline entry with origin "iso-baseline"', () => {
    const snap = getLinetypeRegistrySnapshot();
    for (const def of snap.linetypes) {
      expect(def.origin).toBe('iso-baseline');
    }
  });

  it('returns stable snapshot reference across calls when nothing changes', () => {
    const a = getLinetypeRegistrySnapshot();
    const b = getLinetypeRegistrySnapshot();
    expect(a).toBe(b);
  });
});

describe('LinetypeRegistry — resolve', () => {
  it('resolves all 8 ISO baseline names', () => {
    for (const name of LINETYPE_ISO_NAMES) {
      const def = resolveLinetype(name);
      expect(def).not.toBeNull();
      expect(def?.name).toBe(name);
    }
  });

  it('returns null for unknown names', () => {
    expect(resolveLinetype('Nope')).toBeNull();
    expect(resolveLinetype('')).toBeNull();
  });

  it('is case-sensitive (AutoCAD convention)', () => {
    expect(resolveLinetype('Continuous')).not.toBeNull();
    expect(resolveLinetype('continuous')).toBeNull();
    expect(resolveLinetype('CONTINUOUS')).toBeNull();
  });
});

describe('LinetypeRegistry — registerLinetype', () => {
  const custom: LinetypeDef = {
    id: 'ltp_test01',
    name: 'CustomDash',
    description: 'test',
    pattern: [10, -5],
    origin: 'user-created',
  };

  it('registers a new linetype and appends to insertion order', () => {
    const added = registerLinetype(custom);
    expect(added).toBe(true);
    const snap = getLinetypeRegistrySnapshot();
    expect(snap.linetypes).toHaveLength(9);
    expect(snap.linetypes[8].name).toBe('CustomDash');
    expect(resolveLinetype('CustomDash')).toEqual(custom);
  });

  it('skips silently when name already exists (first wins)', () => {
    expect(registerLinetype(custom)).toBe(true);
    const dup: LinetypeDef = { ...custom, description: 'changed', pattern: [99] };
    expect(registerLinetype(dup)).toBe(false);
    expect(resolveLinetype('CustomDash')?.description).toBe('test');
  });

  it('refuses to overwrite ISO baseline by name collision', () => {
    const collide: LinetypeDef = {
      name: 'Continuous',
      description: 'evil override',
      pattern: [1, -1],
      origin: 'user-created',
    };
    expect(registerLinetype(collide)).toBe(false);
    const def = resolveLinetype('Continuous');
    expect(def?.origin).toBe('iso-baseline');
    expect(def?.pattern).toEqual([]);
  });
});

describe('LinetypeRegistry — registerLinetypes batch', () => {
  it('adds new entries atomically and returns count', () => {
    const defs: LinetypeDef[] = [
      { name: 'A', description: '', pattern: [1, -1], origin: 'lin-import' },
      { name: 'B', description: '', pattern: [2, -2], origin: 'lin-import' },
      { name: 'Continuous', description: 'dup', pattern: [], origin: 'lin-import' },
    ];
    const added = registerLinetypes(defs);
    expect(added).toBe(2);
    expect(getLinetypeRegistrySnapshot().linetypes).toHaveLength(10);
  });

  it('emits exactly one notify for the batch', () => {
    const cb = jest.fn();
    subscribeLinetypeRegistry(cb);
    registerLinetypes([
      { name: 'X', description: '', pattern: [1], origin: 'lin-import' },
      { name: 'Y', description: '', pattern: [2], origin: 'lin-import' },
    ]);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not notify when nothing was added', () => {
    const cb = jest.fn();
    subscribeLinetypeRegistry(cb);
    registerLinetypes([
      { name: 'Continuous', description: '', pattern: [], origin: 'lin-import' },
    ]);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('LinetypeRegistry — subscriptions', () => {
  it('fires subscriber on registration', () => {
    const cb = jest.fn();
    subscribeLinetypeRegistry(cb);
    registerLinetype({
      name: 'Z',
      description: '',
      pattern: [1],
      origin: 'user-created',
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops further notifications', () => {
    const cb = jest.fn();
    const unsub = subscribeLinetypeRegistry(cb);
    unsub();
    registerLinetype({
      name: 'Q',
      description: '',
      pattern: [1],
      origin: 'user-created',
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('LinetypeRegistry — listLinetypes', () => {
  it('mirrors snapshot.linetypes', () => {
    registerLinetype({
      name: 'L',
      description: '',
      pattern: [1],
      origin: 'user-created',
    });
    expect(listLinetypes()).toBe(getLinetypeRegistrySnapshot().linetypes);
  });
});

describe('LinetypeRegistry — __resetForTesting', () => {
  it('restores to ISO baseline only (clears custom registrations)', () => {
    registerLinetype({
      name: 'TempCustom',
      description: '',
      pattern: [1],
      origin: 'user-created',
    });
    expect(getLinetypeRegistrySnapshot().linetypes).toHaveLength(9);
    __resetLinetypeRegistryForTesting();
    expect(getLinetypeRegistrySnapshot().linetypes).toHaveLength(8);
    expect(resolveLinetype('TempCustom')).toBeNull();
  });

  it('clears active subscribers', () => {
    const cb = jest.fn();
    subscribeLinetypeRegistry(cb);
    __resetLinetypeRegistryForTesting();
    registerLinetype({
      name: 'Post',
      description: '',
      pattern: [1],
      origin: 'user-created',
    });
    expect(cb).not.toHaveBeenCalled();
  });
});
