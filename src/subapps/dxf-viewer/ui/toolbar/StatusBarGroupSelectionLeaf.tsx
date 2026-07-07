'use client';

/**
 * StatusBarGroupSelectionLeaf — ADR-575 status-bar readout of the selected GROUP.
 *
 * Mirrors the on-canvas group affordance in text: when GROUP container(s) are
 * selected, shows «Ομάδα · N αντικείμενα» (single group) or «K ομάδες» (multiple),
 * so the group identity + size is legible even away from the box.
 *
 * ADR-040 micro-leaf: subscribes ONLY to the selection set + the current level's
 * scene SSoT (low-freq — selection events, not 60fps), so the status-bar shell does
 * not re-render on cursor activity. Renders nothing when no group is selected.
 * Group resolution reuses the ONE SSoT (`resolveSelectedGroups`).
 */

import { useTranslation } from '@/i18n';
import { useSelectedEntityIds } from '../../systems/selection/useSelectedEntities';
import { useLevelScene } from '../../systems/scene/useSceneSelectors';
import { useLevels } from '../../systems/levels/useLevels';
import { resolveSelectedGroups } from '../../systems/group/group-selection-bounds';

interface StatusBarGroupSelectionLeafProps {
  className?: string;
  separatorClassName?: string;
}

/** Inline «Ομάδα · N αντικείμενα» / «K ομάδες» for the selected group(s), or nothing. */
export function StatusBarGroupSelectionLeaf({ className, separatorClassName }: StatusBarGroupSelectionLeafProps) {
  const { t } = useTranslation('dxf-viewer');
  const { currentLevelId } = useLevels();
  const selectedEntityIds = useSelectedEntityIds();
  const sceneModel = useLevelScene(currentLevelId);

  const groups = resolveSelectedGroups(sceneModel?.entities, selectedEntityIds);
  if (groups.length === 0) return null;

  const text = groups.length === 1
    ? t('groupSelection.label', { count: groups[0].members.length })
    : t('groupSelection.statusMultiple', { count: groups.length });

  return (
    <>
      <span className={separatorClassName}>|</span>
      <span className={className}>{text}</span>
    </>
  );
}
