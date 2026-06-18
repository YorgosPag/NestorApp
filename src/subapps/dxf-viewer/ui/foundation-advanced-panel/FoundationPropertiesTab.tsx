'use client';

/**
 * ADR-463 — sidebar «Properties» tab wrapper για θεμελιακό στοιχείο. Mounted από
 * τον `BimPropertiesRouter` όταν το primary-selected entity είναι foundation.
 * Mirror του `ColumnPropertiesTab`.
 *
 * Resolve από το reactive `currentScene` prop (re-render σε κάθε param edit).
 * Writer = ο κοινός `useFoundationParamsDispatcher`. Subscribe στο
 * `structuralSettingsStore` ώστε ο combo «κανονισμός» + τα readouts να
 * ενημερώνονται reactive όταν αλλάζει ο building-level κανονισμός.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isFoundationEntity } from '../../types/entities';
import { useResolvedSelectedEntity } from '../../hooks/selection/useResolvedSelectedEntity';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { useFoundationParamsDispatcher } from '../ribbon/hooks/bridge/useFoundationParamsDispatcher';
import { FoundationAdvancedPanel } from './FoundationAdvancedPanel';
import type { SceneModel } from '../../types/scene';
import type { FoundationEntity } from '../../bim/types/foundation-types';

export interface FoundationPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function FoundationPropertiesTab({
  primarySelectedId,
  currentScene,
}: FoundationPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const dispatch = useFoundationParamsDispatcher({ levelManager });

  // Reactive: re-render όταν αλλάζει ο building-level κανονισμός (combo «κανονισμός»
  // + readouts βάρους/ρ που εξαρτώνται από τον provider).
  useStructuralSettingsStore((s) => s.codeId);
  // ADR-464 — re-render όταν αλλάζει το σ_allow (combo «έδραση» + bearing readouts).
  useStructuralSettingsStore((s) => s.soilBearingCapacityKpa);

  // ADR-484 — κοινός SSoT resolver (active scene + cross-level foundation fallback).
  const selected = useResolvedSelectedEntity(primarySelectedId, currentScene);
  const footing = React.useMemo<FoundationEntity | null>(
    () => (selected && isFoundationEntity(selected) ? selected : null),
    [selected],
  );

  if (!footing) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('foundationAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('foundationAdvancedPanel.title')}>
      <FoundationAdvancedPanel
        footing={footing}
        dispatch={dispatch}
        containerClassName="flex flex-col gap-3 p-2"
      />
    </section>
  );
}
