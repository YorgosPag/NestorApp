'use client';

/**
 * ADR-471 — sidebar «Properties» tab wrapper για δοκάρι. Mounted από τον
 * `BimPropertiesRouter` όταν το primary-selected entity είναι beam. Mirror του
 * `ColumnPropertiesTab`.
 *
 * Resolve της δοκού από το reactive `currentScene` prop (ίδιο path με κολόνα →
 * re-render σε κάθε param edit). Writer = ο κοινός `useBeamParamsDispatcher` (SSoT
 * με το ribbon). Subscribe στο `structuralSettingsStore` ώστε code/grade combos να
 * ενημερώνονται reactive όταν αλλάζει ο building-level κανονισμός.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { isBeamEntity, isSlabEntity } from '../../types/entities';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { useBeamParamsDispatcher } from '../ribbon/hooks/bridge/useBeamParamsDispatcher';
// ADR-534 Φ3c-A — DERIVED b_eff (πλακοδοκός) στο αριστερό panel· reuse των ΙΔΙΩΝ SSoT με το
// title block (`BeamDetailHost`): detector + ceiling-host builder + topology-aware supportType.
import { resolveBeamEffectiveFlangeWidthMm } from '../../bim/structural/beam-flange-context';
import { resolveActiveBeamSupportType } from '../../bim/structural/active-reinforcement';
import { buildCeilingSlabHosts } from '../../bim-3d/scene/monolithic-slab-clip';
import { BeamAdvancedPanel } from './BeamAdvancedPanel';
import type { SceneModel } from '../../types/scene';
import type { BeamEntity } from '../../bim/types/beam-types';

export interface BeamPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function BeamPropertiesTab({
  primarySelectedId,
  currentScene,
}: BeamPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const dispatch = useBeamParamsDispatcher({ levelManager });

  // Reactive code/grade: re-render όταν αλλάζει ο building-level κανονισμός ή η
  // προεπιλεγμένη κατηγορία σκυροδέματος (combos «κανονισμός»/«σκυρόδεμα»).
  useStructuralSettingsStore((s) => s.codeId);
  useStructuralSettingsStore((s) => s.defaultConcreteGrade);

  const beam = React.useMemo<BeamEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isBeamEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  // ADR-534 Φ3c-A — DERIVED b_eff (T-beam) από τις καλύπτουσες μονολιθικές πλάκες της σκηνής.
  // `undefined` (γυμνή ορθογώνια δοκός) → καμία γραμμή στο panel. Ίδιος υπολογισμός με το title block.
  const effectiveFlangeWidthMm = React.useMemo<number | undefined>(() => {
    if (!beam || !currentScene) return undefined;
    const coveringHosts = buildCeilingSlabHosts(currentScene.entities.filter(isSlabEntity));
    const supportType = resolveActiveBeamSupportType(beam.id) ?? beam.params.supportType ?? 'simple';
    return resolveBeamEffectiveFlangeWidthMm(beam, coveringHosts, supportType);
  }, [beam, currentScene]);

  if (!beam) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('beamAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('beamAdvancedPanel.title')}>
      <BeamAdvancedPanel
        beam={beam}
        dispatch={dispatch}
        effectiveFlangeWidthMm={effectiveFlangeWidthMm}
        containerClassName="flex flex-col gap-3 p-2"
      />
    </section>
  );
}
