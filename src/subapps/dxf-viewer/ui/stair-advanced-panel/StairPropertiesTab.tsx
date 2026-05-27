'use client';

/**
 * ADR-358 Phase 8 (sidebar dock 2026-05-17) — wraps `StairAdvancedPanel`
 * sections inside the left-sidebar floating-panel container as the third
 * tab "Properties". Industry pattern (VS Code Side Bar / ArchiCAD Tray /
 * Revit dockable palettes): a single side-bar container hosts multiple
 * task-specific panels; a "Properties" tab is context-aware and renders
 * the right inspector for whatever entity is currently selected.
 *
 * This wrapper replaces the right-floating `StairAdvancedPanelHost` so the
 * right side of the canvas stays free for the drawing.
 *
 * Render contract:
 *   - stair selected → mount `StairAdvancedPanel` with all sections
 *   - no stair selected → small empty-state hint
 *
 * 2026-05-27 follow-up — persistence πλέον διαβάζεται από
 * `BimPersistenceStateStore` (γραμμένο από `StairPersistenceHost`) αντί για
 * δεύτερη κλήση του `useStairPersistence`. Closes duplicate-audit emission
 * (2× 'created' / 2× 'deleted' per action) λόγω 2 instances ίδιου hook.
 *
 * Auto-tab-switch and disabling of the right floating host are handled at
 * `DxfViewerContent` / `FloatingPanelContainer` orchestration sites — this
 * component stays presentational + side-effect-free for the inner panel.
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../systems/levels';
import { useSelectedStair } from './hooks/useSelectedStair';
import { useStairParamsDispatcher } from './commands/dispatchStairParamPatch';
import { useBimPersistenceStateStore } from '../../bim/persistence/bim-persistence-state-store';
import { StairAdvancedPanel } from './StairAdvancedPanel';
import type { SceneModel } from '../../types/scene';

export interface StairPropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function StairPropertiesTab({
  primarySelectedId,
  currentScene,
  projectId,
}: StairPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const stair = useSelectedStair(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useStairParamsDispatcher({ levelManager });
  const { user } = useAuth();
  const persistence = useBimPersistenceStateStore((s) => s.stair);

  if (!stair) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('stairAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <StairAdvancedPanel
      stair={stair}
      dispatchPatch={dispatchPatch}
      companyId={user?.companyId ?? null}
      userId={user?.uid ?? null}
      projectId={projectId}
      levelManager={levelManager}
      persistence={persistence ?? undefined}
      hideHeader
      containerClassName="flex flex-col gap-3 p-2"
    />
  );
}
