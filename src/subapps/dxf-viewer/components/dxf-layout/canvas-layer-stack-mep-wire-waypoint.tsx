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

import React, { useCallback, useMemo } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import { useMepWireWaypointInteraction } from '../../hooks/canvas/use-mep-wire-waypoint-interaction';
import { useUniversalSelection } from '../../systems/selection';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';

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
  // Revit "click a wire to select it": selecting a circuit = clear the entity
  // selection (mutual exclusivity) + set it as the active circuit (lights its
  // grips + opens the «Κύκλωμα» tab via the existing contextual trigger). The
  // active-circuit store setter is imperative; the entity-selection clear comes
  // from the (low-frequency) selection context — ADR-040 leaf subscription, the
  // shell gains no new `useSyncExternalStore` (CHECK 6C safe).
  const universalSelection = useUniversalSelection();
  const selectCircuit = useCallback(
    (systemId: string) => {
      universalSelection.clearAll();
      useMepCircuitEditorStore.getState().setActiveSystemId(systemId);
    },
    [universalSelection],
  );
  useMepWireWaypointInteraction({
    transform,
    getViewportElement,
    getCurrentLevelId,
    getLevelScene,
    selectCircuit,
  });
  return null;
});
