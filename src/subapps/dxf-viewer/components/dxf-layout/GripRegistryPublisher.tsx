'use client';

/**
 * GripRegistryPublisher — ADR-532 B4 selection-subscribed grip registry leaf.
 *
 * Computes the full unified grip set (DXF + overlay) for the current selection via
 * {@link useGripRegistry} and publishes it to {@link AllGripsStore} (+ the armable
 * subset to {@link ArmableGripsStore}). The grip interaction hook reads these
 * stores at event time, so the CanvasSection orchestrator — which hosts that hook —
 * no longer needs to re-render on selection to keep grip hit-testing current
 * (ADR-040 dual-access invariant).
 *
 * Renders null. Subscribes to the selection set itself; the scene + overlay data
 * arrive as props (they change on scene/overlay edits, which CanvasSection already
 * re-renders for).
 */

import React, { useEffect, useMemo } from 'react';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import { useGripRegistry } from '../../hooks/grips/grip-registry';
import { useSelectedEntityIds, useSelectionByType } from '../../systems/selection/useSelectedEntities';
import { AllGripsStore } from '../../systems/grip/AllGripsStore';
import { ArmableGripsStore } from '../../systems/grip/ArmableGripsStore';
import { hotGripKindOf, isWallHotGripKind } from '../../hooks/grips/wall-hot-grip-fsm';

interface GripRegistryPublisherProps {
  dxfScene: DxfScene | null;
  currentOverlays: Overlay[];
}

export const GripRegistryPublisher: React.FC<GripRegistryPublisherProps> = ({
  dxfScene, currentOverlays,
}) => {
  const selectedEntityIds = useSelectedEntityIds();
  const overlayIds = useSelectionByType('overlay');
  const selectedOverlays = useMemo(
    () => overlayIds
      .map((id) => currentOverlays.find((o) => o.id === id))
      .filter((o): o is Overlay => o !== undefined),
    [overlayIds, currentOverlays],
  );
  const allGrips = useGripRegistry({ dxfScene, selectedEntityIds, selectedOverlays });

  // Publish the full grip set for event-time hit-testing.
  useEffect(() => { AllGripsStore.set(allGrips); }, [allGrips]);
  useEffect(() => () => { AllGripsStore.clear(); }, []);

  // ADR-501 Slice 2 — publish the armable (standard, non-hot-kind) DXF grips so the
  // marquee mouse-up handler can arm the ones a rubber-band catches (moved here from
  // useUnifiedGripInteraction along with the registry).
  useEffect(() => {
    ArmableGripsStore.set(
      allGrips
        .filter((g) => g.source === 'dxf' && g.entityId !== undefined && !isWallHotGripKind(hotGripKindOf(g)))
        .map((g) => ({ entityId: g.entityId as string, gripIndex: g.gripIndex, position: g.position })),
    );
  }, [allGrips]);
  useEffect(() => () => { ArmableGripsStore.clear(); }, []);

  return null;
};
