/**
 * GroupSelectionOverlaySubscriber — ADR-575 / ADR-040 micro-leaf.
 *
 * Subscribes to the selection set (`useSelectedEntityIds`) AND the level's reactive
 * scene SSoT (`useLevelScene`) — the SAME sources `GripRegistryPublisher` reads — so
 * the CanvasLayerStack shell stays subscription-free (ADR-040 cardinal rule #1). It
 * resolves the selected GROUP containers, computes each group's combined bounds via
 * the SSoT (`computeGroupSelectionBounds`), and hands them to the presentational
 * {@link GroupSelectionOverlay}. Only THIS leaf re-renders on a selection/scene change.
 */
'use client';

import React, { useMemo } from 'react';
import GroupSelectionOverlay from '../../canvas-v2/overlays/GroupSelectionOverlay';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import {
  resolveSelectedGroups,
  computeGroupSelectionBounds,
  type GroupSelectionBounds,
} from '../../systems/group/group-selection-bounds';
import type { ViewTransform } from '../../rendering/types/Types';

interface GroupSelectionOverlaySubscriberProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

export const GroupSelectionOverlaySubscriber = React.memo(function GroupSelectionOverlaySubscriber({
  sceneLevelId,
  transform,
  viewport,
  className,
}: GroupSelectionOverlaySubscriberProps) {
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(sceneLevelId);

  const groups: GroupSelectionBounds[] = useMemo(() => {
    const selectedGroups = resolveSelectedGroups(sceneModel?.entities, selectedEntityIds);
    if (selectedGroups.length === 0) return [];
    return selectedGroups
      .map(computeGroupSelectionBounds)
      .filter((b): b is GroupSelectionBounds => b !== null);
  }, [sceneModel, selectedEntityIds]);

  if (groups.length === 0) return null;

  return (
    <GroupSelectionOverlay
      groups={groups}
      viewport={viewport}
      transform={transform}
      className={className}
    />
  );
});
