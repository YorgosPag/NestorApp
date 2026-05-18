'use client';

/**
 * ADR-363 Phase 1D — Discriminating router for the sidebar "Properties" tab.
 *
 * The sidebar third tab is BIM-entity-aware: depending on the type of the
 * primary selected entity, it mounts the matching advanced panel. Currently
 * supports stair (ADR-358) and wall (ADR-363); future BIM elements (opening
 * Phase 2, slab Phase 3, column Phase 4, beam Phase 5) plug in here.
 *
 * Pure derivation — entity classification reads the scene model already held
 * by the orchestrator; no extra subscriptions (ADR-040 micro-leaf rule).
 *
 * When no BIM entity is selected, falls back to the stair tab so legacy
 * stair workflows continue working (stair empty-state renders if no stair).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isWallEntity, isStairEntity } from '../../types/entities';
import { StairPropertiesTab } from '../stair-advanced-panel/StairPropertiesTab';
import { WallPropertiesTab } from './WallPropertiesTab';
import type { SceneModel } from '../../types/scene';

export interface BimPropertiesRouterProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function BimPropertiesRouter(
  props: BimPropertiesRouterProps,
): React.ReactElement {
  const { primarySelectedId, currentScene } = props;
  const { t } = useTranslation('dxf-viewer-shell');

  const selected = React.useMemo(() => {
    if (!primarySelectedId || !currentScene) return null;
    return currentScene.entities.find((e) => e.id === primarySelectedId) ?? null;
  }, [primarySelectedId, currentScene]);

  if (selected && isWallEntity(selected)) {
    return <WallPropertiesTab {...props} />;
  }

  if (selected && isStairEntity(selected)) {
    return <StairPropertiesTab {...props} />;
  }

  // No BIM selection — render the stair tab's empty state (legacy path).
  if (!selected) {
    return <StairPropertiesTab {...props} />;
  }

  return (
    <p className="px-3 py-6 text-center text-xs text-slate-400">
      {t('wallAdvancedPanel.emptyState')}
    </p>
  );
}
