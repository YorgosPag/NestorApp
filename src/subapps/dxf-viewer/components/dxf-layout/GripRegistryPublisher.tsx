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
 * Renders null. Subscribes to the selection set AND — since ADR-040 scene-source
 * parity — to the level's reactive scene SSoT (`useLevelScene`), the SAME source the
 * paint leaf (`DxfCanvasSubscriber`) reads. Overlay data still arrives as a prop.
 *
 * WHY reactive scene (not the `dxfScene` prop): the prop is a non-reactive
 * `getLevelScene()` pull threaded through the orchestrator; it refreshes only on an
 * incidental CanvasSection re-render. A freshly-committed-and-selected entity is
 * painted immediately by the reactive paint leaf, but its grips reached AllGripsStore
 * only after that lagging re-render — so `findNearestGrip` saw zero grips at mousedown
 * and the drag fell through to a whole-entity body-move (grips visible, no resize, no
 * ghost). Reading the same reactive scene keeps hit-test grips ≡ painted grips.
 */

import React, { useEffect, useMemo } from 'react';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneModel } from '../../types/scene';
import type { Overlay } from '../../overlays/types';
import { useGripRegistry } from '../../hooks/grips/grip-registry';
import { collectGroupEntities } from '../../systems/group/group-selection-bounds';
import { useSelectedEntityIds, useSelectionByType } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { AllGripsStore } from '../../systems/grip/AllGripsStore';
import { ArmableGripsStore } from '../../systems/grip/ArmableGripsStore';
import { hotGripKindOf, isWallHotGripKind } from '../../hooks/grips/wall-hot-grip-fsm';

interface GripRegistryPublisherProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  /** Cached SceneModel → DxfScene converter (shares the orchestrator's WeakMap). */
  convertScene: (scene: SceneModel | null) => DxfScene;
  /** Orchestrator scene snapshot — fallback before the store has the level (first paint). */
  dxfScene: DxfScene | null;
  currentOverlays: Overlay[];
}

export const GripRegistryPublisher: React.FC<GripRegistryPublisherProps> = ({
  sceneLevelId, convertScene, dxfScene, currentOverlays,
}) => {
  const selectedEntityIds = useSelectedEntityIds();
  const overlayIds = useSelectionByType('overlay');
  const selectedOverlays = useMemo(
    () => overlayIds
      .map((id) => currentOverlays.find((o) => o.id === id))
      .filter((o): o is Overlay => o !== undefined),
    [overlayIds, currentOverlays],
  );
  // ADR-040 scene-source parity — subscribe to the SAME reactive scene SSoT the paint
  // leaf uses (see header), so a just-created entity's grips reach AllGripsStore on the
  // frame it is painted. Falls back to the orchestrator prop before the store has the level.
  const liveSceneModel = useLevelScene(sceneLevelId);
  const reactiveScene = useMemo(
    () => (liveSceneModel ? convertScene(liveSceneModel) : dxfScene),
    [liveSceneModel, convertScene, dxfScene],
  );
  // ADR-575 §8 — GROUP containers in the live scene, keyed by id. A selected group
  // renders as ONE unit (dashed box + «Ομάδα · N» overlay + shared gizmo), so the
  // registry suppresses its members' per-member grips (which all share `group.id` →
  // only one would show, mis-reading as «one object selected») AND emits the whole-group
  // move/rotation gizmo from the `GroupEntity` (needed for its bounds). Reads the ORIGINAL
  // SceneModel entities (the GroupEntity survives only pre-expansion), NOT the dxfScene.
  const groupEntities = useMemo(
    () => collectGroupEntities(liveSceneModel?.entities),
    [liveSceneModel],
  );
  const allGrips = useGripRegistry({ dxfScene: reactiveScene, selectedEntityIds, selectedOverlays, groupEntities });

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
