'use client';
import React, { useCallback } from 'react';
import { useFilletPreview } from '../../hooks/tools/useFilletPreview';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/scene';

interface FilletPreviewMountProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
  levelManager: {
    getLevelScene: (levelId: string) => SceneModel | null;
    currentLevelId: string | null;
  };
}

/**
 * ADR-510 Φ4e micro-leaf — draws the FILLET live ghost. Reads the live scene at
 * frame time (hover hit-test of the second line / polyline) and recomputes the
 * candidate arc + trims from the FilletToolStore.
 * ADR-040 cardinal rule 1: only this component subscribes to FilletToolStore.
 */
export const FilletPreviewMount = React.memo(function FilletPreviewMount(
  props: FilletPreviewMountProps,
) {
  const { transform, getCanvas, getViewportElement, levelManager } = props;
  const getScene = useCallback(
    () => (levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null),
    [levelManager],
  );
  useFilletPreview({ transform, getCanvas, getViewportElement, getScene });
  return null;
});
