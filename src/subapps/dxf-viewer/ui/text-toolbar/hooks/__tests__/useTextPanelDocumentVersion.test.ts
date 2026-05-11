/**
 * ADR-344 Phase 6.D — useTextPanelDocumentVersion tests.
 *
 * Uses the `__mocks__/useCurrentSceneModel` manual mock to keep the
 * LevelsSystem → Firebase auth import chain out of the test runner.
 */

import { describe, it, expect } from '@jest/globals';
import { renderHook } from '@testing-library/react';

jest.mock('../useCurrentSceneModel');

import { useTextPanelDocumentVersion } from '../useTextPanelDocumentVersion';
import { DxfDocumentVersion } from '../../../../text-engine/types';
import { __setMockScene } from '../__mocks__/useCurrentSceneModel';
import type { SceneModel } from '../../../../types/scene';

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
  afterEach(() => __setMockScene(null));

  it('defaults to R2018 when no scene is loaded', () => {
    __setMockScene(null);
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });

  it('defaults to R2018 when the scene has no $ACADVER tag', () => {
    __setMockScene(makeScene());
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });

  it('maps a recognized $ACADVER string to the matching enum', () => {
    __setMockScene(makeScene('AC1015'));
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2000);
  });

  it('falls back to R2018 on an unrecognized $ACADVER string', () => {
    __setMockScene(makeScene('AC9999'));
    const { result } = renderHook(() => useTextPanelDocumentVersion());
    expect(result.current).toBe(DxfDocumentVersion.R2018);
  });
});
