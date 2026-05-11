/**
 * ADR-344 Phase 6.D — useTextPanelFonts tests.
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { SceneModel } from '../../../../types/scene';

jest.mock('../useCurrentSceneModel', () => {
  let scene: SceneModel | null = null;
  return {
    __esModule: true,
    __setSceneForTest: (s: SceneModel | null) => {
      scene = s;
    },
    useCurrentSceneModel: () => scene,
  };
});

import { useTextPanelFonts } from '../useTextPanelFonts';
import { fontCache } from '../../../../text-engine/fonts';

const { __setSceneForTest } = jest.requireMock('../useCurrentSceneModel') as {
  __setSceneForTest: (s: SceneModel | null) => void;
};

function seedCache(names: string[]): void {
  const cacheUnknown = fontCache as unknown as { byName?: Map<string, unknown> };
  if (!cacheUnknown.byName) cacheUnknown.byName = new Map();
  cacheUnknown.byName.clear();
  for (const n of names) cacheUnknown.byName.set(n.toLowerCase(), {});
}

function makeScene(fonts: string[]): SceneModel {
  return {
    entities: fonts.map((fontFamily, i) => ({
      id: `e_${i}`,
      type: 'text',
      layer: '0',
      visible: true,
      position: { x: 0, y: 0 },
      text: 'x',
      fontFamily,
    })) as unknown as SceneModel['entities'],
    layers: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

describe('useTextPanelFonts', () => {
  afterEach(() => {
    __setSceneForTest(null);
    seedCache([]);
  });

  it('returns an empty list when neither cache nor scene have fonts', () => {
    __setSceneForTest(null);
    seedCache([]);
    const { result } = renderHook(() => useTextPanelFonts());
    expect(result.current).toEqual([]);
  });

  it('reports every cached font name', () => {
    __setSceneForTest(null);
    seedCache(['arial', 'times']);
    const { result } = renderHook(() => useTextPanelFonts());
    expect(result.current).toEqual(['arial', 'times']);
  });

  it('unions cached names with scene-referenced fontFamily values', () => {
    __setSceneForTest(makeScene(['Roboto', 'Arial']));
    seedCache(['arial', 'times']);
    const { result } = renderHook(() => useTextPanelFonts());
    expect(result.current).toContain('Roboto');
    expect(result.current).toContain('Arial');
    expect(result.current).toContain('times');
  });

  it('returns names sorted', () => {
    __setSceneForTest(null);
    seedCache(['zeta', 'alpha', 'beta']);
    const { result } = renderHook(() => useTextPanelFonts());
    expect(result.current).toEqual(['alpha', 'beta', 'zeta']);
  });
});
