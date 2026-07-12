'use client';

/**
 * StatusBarBlockSelectionLeaf — ADR-640 status-bar readout of the selected BLOCK
 * (mirror of StatusBarGroupSelectionLeaf, ADR-575).
 *
 * Mirrors the on-canvas block affordance in text: when BLOCK container(s) are selected,
 * shows «Μπλοκ «name» · N αντικείμενα» (single block) or «K μπλοκ» (multiple), so the
 * block identity + size is legible even away from the box.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the selection set + the current level's scene
 * SSoT (low-freq — selection events, not 60fps), so the status-bar shell does not re-render
 * on cursor activity. Renders nothing when no block is selected. Block resolution reuses the
 * ONE SSoT (`resolveSelectedBlocks`).
 */

import { useTranslation } from '@/i18n';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { useLevels } from '../../systems/levels/useLevels';
import { resolveSelectedBlocks } from '../../systems/block/block-selection-bounds';

interface StatusBarBlockSelectionLeafProps {
  className?: string;
  separatorClassName?: string;
}

/** Inline «Μπλοκ «name» · N αντικείμενα» / «K μπλοκ» for the selected block(s), or nothing. */
export function StatusBarBlockSelectionLeaf({ className, separatorClassName }: StatusBarBlockSelectionLeafProps) {
  const { t } = useTranslation('dxf-viewer');
  const { currentLevelId } = useLevels();
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(currentLevelId);

  const blocks = resolveSelectedBlocks(sceneModel?.entities, selectedEntityIds);
  if (blocks.length === 0) return null;

  const text = blocks.length === 1
    ? t('blockSelection.label', { name: blocks[0].name, count: blocks[0].entities.length })
    : t('blockSelection.statusMultiple', { count: blocks.length });

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>{text}</span>
    </>
  );
}
