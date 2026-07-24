'use client';

/**
 * ADR-407 Φ9 — wraps `RailingAdvancedPanel` sections inside the left-sidebar
 * floating-panel container as the "Properties" tab. Mirrors
 * `StairPropertiesTab` (ADR-358 Phase 8) / `WallPropertiesTab` (ADR-363).
 *
 * Render contract:
 *   - railing selected → mount `RailingAdvancedPanel` with all sections
 *   - no railing selected → small empty-state hint
 *
 * No persistence wiring (unlike stair) — the railing entity does not yet
 * have a `BimPersistenceStateStore` slot; this stays presentational +
 * side-effect-free for the inner panel, same as the other per-type tabs.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { useSelectedRailing } from './hooks/useSelectedRailing';
import { useRailingParamsDispatcher } from './commands/dispatchRailingParamPatch';
import { RailingAdvancedPanel } from './RailingAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface RailingPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function RailingPropertiesTab({
  primarySelectedId,
  currentScene,
}: RailingPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const railing = useSelectedRailing(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useRailingParamsDispatcher({ levelManager });

  if (!railing) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('railingAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <RailingAdvancedPanel
      railing={railing}
      dispatchPatch={dispatchPatch}
      hideHeader
      containerClassName="flex flex-col gap-3 p-2"
    />
  );
}
