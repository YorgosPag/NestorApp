'use client';

/**
 * ADR-476 — sidebar «Properties» tab wrapper για πλάκα. Mounted από τον
 * `BimPropertiesRouter` όταν το primary-selected entity είναι slab. Mirror του
 * `BeamPropertiesTab`.
 *
 * Resolve της πλάκας από το reactive `currentScene` prop (ίδιο path με δοκό →
 * re-render σε κάθε param edit). Writer = ο κοινός `useSlabParamsDispatcher` (SSoT
 * με το ribbon). Subscribe στο `structuralSettingsStore` ώστε code/grade combos να
 * ενημερώνονται reactive όταν αλλάζει ο building-level κανονισμός.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isSlabEntity } from '../../types/entities';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { useSlabParamsDispatcher } from '../ribbon/hooks/bridge/useSlabParamsDispatcher';
import { SlabAdvancedPanel } from './SlabAdvancedPanel';
import type { SceneModel } from '../../types/scene';
import type { SlabEntity } from '../../bim/types/slab-types';

export interface SlabPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function SlabPropertiesTab({
  primarySelectedId,
  currentScene,
}: SlabPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const dispatch = useSlabParamsDispatcher({ levelManager });

  // Reactive code/grade: re-render όταν αλλάζει ο building-level κανονισμός ή η
  // προεπιλεγμένη κατηγορία σκυροδέματος (combos «κανονισμός»/«σκυρόδεμα»).
  useStructuralSettingsStore((s) => s.codeId);
  useStructuralSettingsStore((s) => s.defaultConcreteGrade);

  const slab = React.useMemo<SlabEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isSlabEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  if (!slab) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('slabAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('slabAdvancedPanel.title')}>
      <SlabAdvancedPanel
        slab={slab}
        dispatch={dispatch}
        containerClassName="flex flex-col gap-3 p-2"
      />
    </section>
  );
}
