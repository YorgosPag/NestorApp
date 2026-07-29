'use client';

/**
 * ADR-376 Phase C.1 — Opening Tag Drag Mount.
 *
 * Micro-leaf component (ADR-040) that wires `useOpeningTagDragInteraction`
 * into the canvas-layer-stack composition. Renders nothing — owns only the
 * pointer event listeners for opening tag drag interactions.
 *
 * @see ../../hooks/canvas/use-opening-tag-drag-interaction.ts
 */

import React, { useMemo } from 'react';
import type { SceneModel } from '../../types/entities';
import { useOpeningTagDragInteraction } from '../../hooks/canvas/use-opening-tag-drag-interaction';

export interface OpeningTagDragMountProps {
  // ADR-040 Phase XXII.B — το transform prop αφαιρέθηκε (βλ. ImmediateTransformStore SSoT).
  readonly getViewportElement: () => HTMLElement | null;
  readonly currentLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
}

export const OpeningTagDragMount = React.memo(function OpeningTagDragMount(
  props: OpeningTagDragMountProps,
) {
  const { getViewportElement, currentLevelId, getLevelScene, setLevelScene } = props;
  // Wrap `currentLevelId` value in a getter so the hook's event handlers
  // always observe the latest level without a teardown / re-mount each switch.
  const getCurrentLevelId = useMemo(() => () => currentLevelId, [currentLevelId]);
  useOpeningTagDragInteraction({
    getViewportElement,
    getCurrentLevelId,
    getLevelScene,
    setLevelScene,
  });
  return null;
});
