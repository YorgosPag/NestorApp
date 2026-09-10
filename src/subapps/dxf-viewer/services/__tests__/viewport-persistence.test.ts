/**
 * viewport-persistence.test.ts — ADR-400 SSoT coverage.
 *
 * Verifies URL serialize/parse roundtrip, finite/NaN guards, localStorage
 * fallback, and the combined restore facade (URL-wins → storage-fallback).
 */

import type { ViewTransform } from '../../rendering/types/Types';
import {
  serializeViewportToParams,
  parseViewportFromParams,
  readViewportFromUrl,
  writeViewportToUrl,
  readViewportFromStorage,
  writeViewportToStorage,
  clearViewportStorage,
  readPersistedViewport,
  readPersistedLevelId,
  persistViewport,
  readActiveBuildingFromUrl,
  writeActiveBuildingToUrl,
} from '../viewport-persistence';

const T: ViewTransform = { scale: 2.5, offsetX: 120.7, offsetY: -340.2 };

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/dxf/viewer');
});

describe('serialize ↔ parse', () => {
  it('roundtrips a transform + level through URL params', () => {
    const params = serializeViewportToParams(T, 'lvl-A');
    const parsed = parseViewportFromParams(params);
    // offsets round to integers, scale to 5 sig figs
    expect(parsed.transform).toEqual({ scale: 2.5, offsetX: 121, offsetY: -340 });
    expect(parsed.levelId).toBe('lvl-A');
  });

  it('omits the level key when levelId is null', () => {
    const params = serializeViewportToParams(T, null);
    expect(params.has('lvl')).toBe(false);
    expect(parseViewportFromParams(params).levelId).toBeUndefined();
  });

  it('preserves unrelated base query keys', () => {
    const base = new URLSearchParams('foo=bar');
    const params = serializeViewportToParams(T, 'lvl-A', base);
    expect(params.get('foo')).toBe('bar');
  });

  it('rounds scale to 5 significant figures', () => {
    const params = serializeViewportToParams(
      { scale: 1.234567891, offsetX: 0, offsetY: 0 },
      null,
    );
    expect(params.get('s')).toBe('1.2346');
  });
});

describe('parse guards', () => {
  it('rejects a transform when any component is missing', () => {
    const parsed = parseViewportFromParams(new URLSearchParams('s=2&ox=10'));
    expect(parsed.transform).toBeUndefined();
  });

  it('rejects non-finite / non-positive scale', () => {
    expect(parseViewportFromParams(new URLSearchParams('s=NaN&ox=1&oy=2')).transform).toBeUndefined();
    expect(parseViewportFromParams(new URLSearchParams('s=0&ox=1&oy=2')).transform).toBeUndefined();
    expect(parseViewportFromParams(new URLSearchParams('s=-1&ox=1&oy=2')).transform).toBeUndefined();
  });

  it('still returns levelId even when the transform is invalid', () => {
    const parsed = parseViewportFromParams(new URLSearchParams('lvl=lvl-Z'));
    expect(parsed.transform).toBeUndefined();
    expect(parsed.levelId).toBe('lvl-Z');
  });
});

describe('URL read/write (history.replaceState)', () => {
  it('writes to the URL without navigating, and reads back', () => {
    writeViewportToUrl(T, 'lvl-A');
    expect(window.location.pathname).toBe('/dxf/viewer');
    const parsed = readViewportFromUrl();
    expect(parsed.transform).toEqual({ scale: 2.5, offsetX: 121, offsetY: -340 });
    expect(parsed.levelId).toBe('lvl-A');
  });

  it('keeps unrelated query keys already on the URL', () => {
    window.history.replaceState({}, '', '/dxf/viewer?foo=bar');
    writeViewportToUrl(T, null);
    expect(new URLSearchParams(window.location.search).get('foo')).toBe('bar');
  });
});

/**
 * ADR-845 §7.15 — the building scope (`?bldg=`). Anchor for the 2026-09-10 crash
 * `mutate is not a function`: the writer handed a `URLSearchParams` to
 * `replaceUrlSearchParams`, which takes a MUTATOR. The subapp is outside the root
 * tsconfig, so only an executed test can catch that shape of mistake here.
 */
describe('building scope (?bldg=)', () => {
  it('writes the building without navigating, and reads it back', () => {
    writeActiveBuildingToUrl('bldg-A');
    expect(window.location.pathname).toBe('/dxf/viewer');
    expect(readActiveBuildingFromUrl()).toBe('bldg-A');
  });

  it('keeps the viewport / level / camera keys already on the URL', () => {
    window.history.replaceState({}, '', '/dxf/viewer?s=2&ox=1&oy=2&lvl=lvl-A&c3d=1%2C2');
    writeActiveBuildingToUrl('bldg-A');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('lvl')).toBe('lvl-A');
    expect(params.get('c3d')).toBe('1,2');
    expect(params.get('s')).toBe('2');
  });

  it('removes the key when the building is null', () => {
    writeActiveBuildingToUrl('bldg-A');
    writeActiveBuildingToUrl(null);
    expect(readActiveBuildingFromUrl()).toBeNull();
    expect(window.location.search).not.toContain('bldg');
  });

  it('survives a viewport write (fit-to-view never erases the building)', () => {
    writeActiveBuildingToUrl('bldg-A');
    writeViewportToUrl(T, null);
    expect(readActiveBuildingFromUrl()).toBe('bldg-A');
  });
});

describe('localStorage fallback', () => {
  it('writes + reads per fileRecordId', () => {
    writeViewportToStorage('file-1', T, 'lvl-A');
    const read = readViewportFromStorage('file-1');
    expect(read.transform).toEqual(T);
    expect(read.levelId).toBe('lvl-A');
  });

  it('returns empty for a missing / null id', () => {
    expect(readViewportFromStorage(null)).toEqual({});
    expect(readViewportFromStorage('nope')).toEqual({});
  });

  it('drops an invalid stored transform', () => {
    localStorage.setItem(
      'dxf-viewer:viewport-state:file-1',
      JSON.stringify({ transform: { scale: 0, offsetX: 1, offsetY: 2 }, levelId: 'x' }),
    );
    const read = readViewportFromStorage('file-1');
    expect(read.transform).toBeUndefined();
    expect(read.levelId).toBe('x');
  });

  it('clears the stored entry', () => {
    writeViewportToStorage('file-1', T, 'lvl-A');
    clearViewportStorage('file-1');
    expect(readViewportFromStorage('file-1')).toEqual({});
  });
});

describe('combined facade', () => {
  it('URL transform wins over storage', () => {
    writeViewportToStorage('file-1', { scale: 9, offsetX: 9, offsetY: 9 }, 'lvl-S');
    writeViewportToUrl(T, 'lvl-U');
    const restored = readPersistedViewport('file-1');
    expect(restored.transform).toEqual({ scale: 2.5, offsetX: 121, offsetY: -340 });
    expect(restored.levelId).toBe('lvl-U');
  });

  it('falls back to storage when the URL has no transform', () => {
    writeViewportToStorage('file-1', T, 'lvl-S');
    const restored = readPersistedViewport('file-1');
    expect(restored.transform).toEqual(T);
    expect(restored.levelId).toBe('lvl-S');
  });

  it('readPersistedLevelId prefers URL then storage', () => {
    writeViewportToStorage('file-1', T, 'lvl-S');
    expect(readPersistedLevelId('file-1')).toBe('lvl-S');
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl-U');
    expect(readPersistedLevelId('file-1')).toBe('lvl-U');
  });

  it('persistViewport writes BOTH url and storage', () => {
    persistViewport('file-1', T, 'lvl-A');
    expect(readViewportFromUrl().transform).toEqual({ scale: 2.5, offsetX: 121, offsetY: -340 });
    expect(readViewportFromStorage('file-1').transform).toEqual(T);
  });

  it('persistViewport ignores an invalid transform', () => {
    persistViewport('file-1', { scale: NaN, offsetX: 0, offsetY: 0 }, 'lvl-A');
    expect(readViewportFromUrl().transform).toBeUndefined();
    expect(readViewportFromStorage('file-1')).toEqual({});
  });
});
