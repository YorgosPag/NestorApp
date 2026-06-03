'use client';

/**
 * ADR-408 Φ7 FU#3 — MEP Wire Waypoint Drag Mount.
 *
 * Micro-leaf (ADR-040) that wires `useMepWireWaypointInteraction` into the
 * canvas-layer-stack composition. Renders nothing — owns only the pointer
 * listeners that make the active circuit's home-run wire directly editable
 * (insert / move / delete vertices).
 *
 * @see ../../hooks/canvas/use-mep-wire-waypoint-interaction.ts
 */

import React, { useMemo } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import { useMepWireWaypointInteraction } from '../../hooks/canvas/use-mep-wire-waypoint-interaction';

export interface MepWireWaypointDragMountProps {
  readonly transform: ViewTransform;
  readonly getViewportElement: () => HTMLElement | null;
  readonly currentLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
}

export const MepWireWaypointDragMount = React.memo(function MepWireWaypointDragMount(
  props: MepWireWaypointDragMountProps,
) {
  const { transform, getViewportElement, currentLevelId, getLevelScene } = props;
  // Wrap `currentLevelId` in a getter so handlers observe the latest level
  // without an effect teardown / re-mount on every floor switch.
  const getCurrentLevelId = useMemo(() => () => currentLevelId, [currentLevelId]);
  useMepWireWaypointInteraction({
    transform,
    getViewportElement,
    getCurrentLevelId,
    getLevelScene,
  });
  return null;
});
