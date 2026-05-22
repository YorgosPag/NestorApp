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
import { useStairPersistence } from '../../bim/hooks/use-stair-persistence';
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
  floorplanId,
}: StairPropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const stair = useSelectedStair(primarySelectedId, currentScene);
  const levelManager = useLevels();
  const dispatchPatch = useStairParamsDispatcher({ levelManager });
  const { user } = useAuth();

  // Phase 8 — persistence + soft-lock. Hook always called (rules of hooks);
  // it no-ops internally until companyId/projectId/floorplanId/userId are set.
  const persistence = useStairPersistence({
    companyId: user?.companyId ?? null,
    projectId,
    floorplanId,
    userId: user?.uid ?? null,
    levelManager,
    primarySelectedStair: stair,
  });

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
      persistence={persistence}
      hideHeader
      containerClassName="flex flex-col gap-3 p-2"
    />
  );
}
