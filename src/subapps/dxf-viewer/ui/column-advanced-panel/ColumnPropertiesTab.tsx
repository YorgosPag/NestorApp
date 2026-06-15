'use client';

/**
 * ADR-363 Phase 4 / Properties-palette split — sidebar «Properties» tab wrapper
 * για κολώνα. Mounted από τον `BimPropertiesRouter` όταν το primary-selected
 * entity είναι column. Mirror του `WallPropertiesTab` / `StairPropertiesTab`.
 *
 * Resolve της κολώνας από το reactive `currentScene` prop (ίδιο path με
 * wall/stair → re-render σε κάθε param edit). Writer = ο κοινός
 * `useColumnParamsDispatcher` (SSoT με το ribbon). Subscribe στο
 * `structuralSettingsStore` ώστε code/grade combos να ενημερώνονται reactive
 * όταν αλλάζει ο building-level κανονισμός.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isColumnEntity } from '../../types/entities';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { useColumnParamsDispatcher } from '../ribbon/hooks/bridge/useColumnParamsDispatcher';
import { ColumnAdvancedPanel } from './ColumnAdvancedPanel';
import type { SceneModel } from '../../types/scene';
import type { ColumnEntity } from '../../bim/types/column-types';

export interface ColumnPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function ColumnPropertiesTab({
  primarySelectedId,
  currentScene,
}: ColumnPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const dispatch = useColumnParamsDispatcher({ levelManager });

  // Reactive code/grade: re-render όταν αλλάζει ο building-level κανονισμός ή η
  // προεπιλεγμένη κατηγορία σκυροδέματος (combos «κανονισμός»/«σκυρόδεμα»).
  useStructuralSettingsStore((s) => s.codeId);
  useStructuralSettingsStore((s) => s.defaultConcreteGrade);

  const column = React.useMemo<ColumnEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isColumnEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  if (!column) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('columnAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('columnAdvancedPanel.title')}>
      <ColumnAdvancedPanel
        column={column}
        dispatch={dispatch}
        containerClassName="flex flex-col gap-3 p-2"
      />
    </section>
  );
}
