'use client';
import React, { useCallback } from 'react';
import { useChamferPreview } from '../../hooks/tools/useChamferPreview';
import type { SceneModel } from '../../types/scene';

interface ChamferPreviewMountProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement: () => HTMLElement | null;
  levelManager: {
    getLevelScene: (levelId: string) => SceneModel | null;
    currentLevelId: string | null;
  };
}

/**
 * ADR-510 Φ4f micro-leaf — draws the CHAMFER live ghost (bevel line + trims, or a
 * beveled polyline). Reads the live scene at frame time for the hover hit-test.
 * ADR-040 cardinal rule 1: only this component subscribes to ChamferToolStore.
 */
export const ChamferPreviewMount = React.memo(function ChamferPreviewMount(
  props: ChamferPreviewMountProps,
) {
  const { getCanvas, getViewportElement, levelManager } = props;
  const getScene = useCallback(
    () => (levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null),
    [levelManager],
  );
  useChamferPreview({ getCanvas, getViewportElement, getScene });
  return null;
});
