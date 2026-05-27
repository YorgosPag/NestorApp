'use client';

/**
 * ADR-363 Phase 1D — Sidebar tab wrapper for the Wall Advanced Panel.
 *
 * Mirror `StairPropertiesTab` (ADR-358 Phase 8 sidebar dock). Mounted by the
 * `BimPropertiesRouter` when the primary selected entity is a wall. Resolves
 * auth + persistence context (no-ops internally until scope is set) and
 * forwards the entity + writers to `WallAdvancedPanel`.
 *
 * 2026-05-27 follow-up — persistence πλέον διαβάζεται από
 * `BimPersistenceStateStore` (γραμμένο από `WallPersistenceHost`) αντί για
 * δεύτερη κλήση του `useWallPersistence`. Closes duplicate-audit emission
 * (2× 'created' / 2× 'deleted' per action) λόγω 2 instances ίδιου hook.
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { useSelectedWall } from './hooks/useSelectedWall';
import { useWallParamsDispatcher } from './commands/dispatchWallParamPatch';
import { useBimPersistenceStateStore } from '../../bim/persistence/bim-persistence-state-store';
import { WallAdvancedPanel } from './WallAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface WallPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function WallPropertiesTab({
  primarySelectedId,
  currentScene,
}: WallPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const wall = useSelectedWall(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useWallParamsDispatcher({ levelManager });
  const { user } = useAuth();
  const persistence = useBimPersistenceStateStore((s) => s.wall);

  if (!wall) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('wallAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <WallAdvancedPanel
      wall={wall}
      dispatchPatch={dispatchPatch}
      userId={user?.uid ?? null}
      levelManager={levelManager}
      persistence={persistence ?? undefined}
      hideHeader
      containerClassName="flex flex-col gap-3 p-2"
    />
  );
}
