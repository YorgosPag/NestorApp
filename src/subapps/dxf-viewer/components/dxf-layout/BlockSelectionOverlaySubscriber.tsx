/**
 * BlockSelectionOverlaySubscriber — ADR-640 / ADR-040 micro-leaf (mirror of
 * GroupSelectionOverlaySubscriber).
 *
 * Subscribes to the selection set (`useSelectedEntityIds`) AND the level's reactive scene
 * SSoT (`useLevelScene`) — the SAME sources the group leaf reads — so the CanvasLayerStack
 * shell stays subscription-free (ADR-040 cardinal rule #1). It resolves the selected BLOCK
 * containers, computes each block's combined bounds via the SSoT
 * (`computeBlockSelectionBounds`), attaches the pre-resolved «Μπλοκ «name» · N» label, and
 * hands them to the SHARED presentational {@link GroupSelectionOverlay}. Only THIS leaf
 * re-renders on a selection/scene change.
 */
'use client';

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import GroupSelectionOverlay, { type LabeledSelectionBounds } from '../../canvas-v2/overlays/GroupSelectionOverlay';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import {
  resolveSelectedBlocks,
  computeBlockSelectionBounds,
} from '../../systems/block/block-selection-bounds';
import type { ViewTransform } from '../../rendering/types/Types';

interface BlockSelectionOverlaySubscriberProps {
  /** Active level id — the reactive scene slice this leaf subscribes to (ADR-040). */
  sceneLevelId: string | null;
  transform: ViewTransform;
  viewport: { width: number; height: number };
  className?: string;
}

export const BlockSelectionOverlaySubscriber = React.memo(function BlockSelectionOverlaySubscriber({
  sceneLevelId,
  transform,
  viewport,
  className,
}: BlockSelectionOverlaySubscriberProps) {
  const { t } = useTranslation('dxf-viewer');
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(sceneLevelId);

  const blocks: LabeledSelectionBounds[] = useMemo(() => {
    const selectedBlocks = resolveSelectedBlocks(sceneModel?.entities, selectedEntityIds);
    if (selectedBlocks.length === 0) return [];
    return selectedBlocks
      .map((block): LabeledSelectionBounds | null => {
        const bounds = computeBlockSelectionBounds(block);
        return bounds
          ? { ...bounds, label: t('blockSelection.label', { name: block.name, count: block.entities.length }) }
          : null;
      })
      .filter((b): b is LabeledSelectionBounds => b !== null);
  }, [sceneModel, selectedEntityIds, t]);

  if (blocks.length === 0) return null;

  return (
    <GroupSelectionOverlay
      groups={blocks}
      viewport={viewport}
      transform={transform}
      className={className}
    />
  );
});
