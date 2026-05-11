/**
 * ADR-344 Phase 6.D — useTextPanelDocumentVersion tests.
 *
 * Inline mock factory: `jest.mock` calls hoist above imports, so the
 * mutable scene state must live inside the factory closure. We expose
 * `__setSceneForTest` and access it via `jest.requireMock`.
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

import { useTextPanelDocumentVersion } from '../useTextPanelDocumentVersion';
import { DxfDocumentVersion } from '../../../../text-engine/types';

const { __setSceneForTest } = jest.requireMock('../useCurrentSceneModel') as {
  __setSceneForTest: (s: SceneModel | null) => void;
};

function makeScene(version?: string): SceneModel {
  return {
    entities: [],
    layers: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
    version,
  };
}

describe('useTextPanelDocumentVersion', () => {
  afterEach(() => __setSceneForTest(null));

  it('defaults to R2018 when no scene is loaded', () => {
    __setSceneForTest(null);
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });

  it('defaults to R2018 when the scene has no $ACADVER tag', () => {
    __setSceneForTest(makeScene());
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });

  it('maps a recognized $ACADVER string to the matching enum', () => {
    __setSceneForTest(makeScene('AC1015'));
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2000);
  });

  it('falls back to R2018 on an unrecognized $ACADVER string', () => {
    __setSceneForTest(makeScene('AC9999'));
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });
});
