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
import { useTranslation } from '@/i18n';
import GroupSelectionOverlay, { type LabeledSelectionBounds } from '../../canvas-v2/overlays/GroupSelectionOverlay';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import {
  resolveSelectedGroups,
  computeGroupSelectionBounds,
} from '../../systems/group/group-selection-bounds';
// ADR-040 Phase XXII.B — transform subscription στο inner layer (mounted μόνο με επιλεγμένα
// groups), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';

interface GroupSelectionOverlaySubscriberProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  viewport: { width: number; height: number };
  className?: string;
}

export const GroupSelectionOverlaySubscriber = React.memo(function GroupSelectionOverlaySubscriber({
  sceneLevelId,
  viewport,
  className,
}: GroupSelectionOverlaySubscriberProps) {
  const { t } = useTranslation('dxf-viewer');
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(sceneLevelId);

  const groups: LabeledSelectionBounds[] = useMemo(() => {
    const selectedGroups = resolveSelectedGroups(sceneModel?.entities, selectedEntityIds);
    if (selectedGroups.length === 0) return [];
    return selectedGroups
      .map((group): LabeledSelectionBounds | null => {
        const bounds = computeGroupSelectionBounds(group);
        return bounds
          ? { ...bounds, label: t('groupSelection.label', { count: bounds.memberCount }) }
          : null;
      })
      .filter((b): b is LabeledSelectionBounds => b !== null);
  }, [sceneModel, selectedEntityIds, t]);

  if (groups.length === 0) return null;

  return <GroupSelectionTransformLayer groups={groups} viewport={viewport} className={className} />;
});

/** Inner layer — mounted ΜΟΝΟ με επιλεγμένα groups· κατέχει το transform subscription. */
function GroupSelectionTransformLayer({
  groups, viewport, className,
}: {
  groups: LabeledSelectionBounds[];
  viewport: { width: number; height: number };
  className?: string;
}) {
  const transform = useTransformValue();
  return (
    <GroupSelectionOverlay
      groups={groups}
      viewport={viewport}
      transform={transform}
      className={className}
    />
  );
}
