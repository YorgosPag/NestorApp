/**
 * camera3d-persistence.test.ts — ADR-400 §3D SSoT coverage.
 *
 * Mirrors viewport-persistence.test.ts: compact URL serialize/parse roundtrip,
 * finite/positive/projection guards, localStorage fallback, and the combined
 * restore facade (URL-wins → storage-fallback).
 */

import {
  serializeCamera3DToParam,
  parseCamera3DFromParam,
  readCamera3DFromUrl,
  writeCamera3DToUrl,
  readCamera3DFromStorage,
  writeCamera3DToStorage,
  clearCamera3DStorage,
  readPersistedCamera3D,
  persistCamera3D,
  type Camera3DPose,
} from '../camera3d-persistence';

const POSE: Camera3DPose = {
  position: [15.1234, 10.5, 15.9876],
  target: [0, 0, 0],
  zoom: 1.23456789,
  projection: 'perspective',
};
const TOP_POSE: Camera3DPose = {
  position: [2, 50, 2],
  target: [2, 0, 2],
  zoom: 3.5,
  projection: 'top',
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/dxf/viewer');
});

describe('serialize ↔ parse', () => {
  it('roundtrips a pose through the compact c3d CSV', () => {
    const parsed = parseCamera3DFromParam(serializeCamera3DToParam(POSE));
    // coords round to 3 decimals (mm), zoom to 5 sig figs
    expect(parsed).toEqual({
      position: [15.123, 10.5, 15.988],
      target: [0, 0, 0],
      zoom: 1.2346,
      projection: 'perspective',
    });
  });

  it('encodes each projection mode with a stable single-char code', () => {
    expect(serializeCamera3DToParam(TOP_POSE).endsWith(',t')).toBe(true);
    expect(parseCamera3DFromParam(serializeCamera3DToParam(TOP_POSE))?.projection).toBe('top');
  });
});

describe('parse guards', () => {
  it('rejects a wrong field count', () => {
    expect(parseCamera3DFromParam('1,2,3,4,5,6,7')).toBeNull(); // 7 parts
    expect(parseCamera3DFromParam('')).toBeNull();
    expect(parseCamera3DFromParam(null)).toBeNull();
  });

  it('rejects a non-finite coordinate or non-positive zoom', () => {
    expect(parseCamera3DFromParam('NaN,0,0,0,0,0,1,p')).toBeNull();
    expect(parseCamera3DFromParam('1,2,3,4,5,6,0,p')).toBeNull(); // zoom 0
    expect(parseCamera3DFromParam('1,2,3,4,5,6,-1,p')).toBeNull(); // zoom < 0
  });

  it('rejects an unknown projection code', () => {
    expect(parseCamera3DFromParam('1,2,3,4,5,6,1,z')).toBeNull();
  });
});

describe('URL read/write (history.replaceState)', () => {
  it('writes the c3d key without navigating, and reads back', () => {
    writeCamera3DToUrl(TOP_POSE);
    expect(window.location.pathname).toBe('/dxf/viewer');
    expect(readCamera3DFromUrl()).toEqual(TOP_POSE);
  });

  it('keeps unrelated query keys already on the URL', () => {
    window.history.replaceState({}, '', '/dxf/viewer?lvl=lvl-A');
    writeCamera3DToUrl(POSE);
    expect(new URLSearchParams(window.location.search).get('lvl')).toBe('lvl-A');
  });
});

describe('localStorage fallback', () => {
  it('writes + reads per fileRecordId', () => {
    writeCamera3DToStorage('file-1', TOP_POSE);
    expect(readCamera3DFromStorage('file-1')).toEqual(TOP_POSE);
  });

  it('returns null for a missing / null id', () => {
    expect(readCamera3DFromStorage(null)).toBeNull();
    expect(readCamera3DFromStorage('nope')).toBeNull();
  });

  it('drops an invalid stored pose', () => {
    localStorage.setItem(
      'dxf-viewer:camera3d-state:file-1',
      JSON.stringify({ position: [1, 2, 3], target: [0, 0, 0], zoom: 0, projection: 'top' }),
    );
    expect(readCamera3DFromStorage('file-1')).toBeNull();
  });

  it('clears the stored entry', () => {
    writeCamera3DToStorage('file-1', TOP_POSE);
    clearCamera3DStorage('file-1');
    expect(readCamera3DFromStorage('file-1')).toBeNull();
  });
});

describe('combined facade', () => {
  it('URL pose wins over storage', () => {
    writeCamera3DToStorage('file-1', TOP_POSE);
    writeCamera3DToUrl(POSE);
    expect(readPersistedCamera3D('file-1')?.projection).toBe('perspective');
  });

  it('falls back to storage when the URL has no pose', () => {
    writeCamera3DToStorage('file-1', TOP_POSE);
    expect(readPersistedCamera3D('file-1')).toEqual(TOP_POSE);
  });

  it('persistCamera3D writes BOTH url and storage', () => {
    persistCamera3D('file-1', TOP_POSE);
    expect(readCamera3DFromUrl()).toEqual(TOP_POSE);
    expect(readCamera3DFromStorage('file-1')).toEqual(TOP_POSE);
  });

  it('ignores an invalid pose', () => {
    persistCamera3D('file-1', { ...POSE, zoom: NaN });
    expect(readCamera3DFromUrl()).toBeNull();
    expect(readCamera3DFromStorage('file-1')).toBeNull();
  });
});
