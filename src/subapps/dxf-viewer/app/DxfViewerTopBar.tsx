'use client';

/**
 * ADR-358 Phase 8 size-extract — top-bar wrapper estratto da `DxfViewerContent`
 * per rispettare N.7.1 (max 500 righe / file). Raggruppa il `RibbonRoot` con
 * il `StairAdvancedPanelHost` floating panel, e deriva qui i campi di scope
 * `projectId` / `floorplanId` dal `levelManager` (Phase 8 reactive mirrors).
 *
 * Zero subscriptions a high-frequency stores: questo wrapper riceve tutto via
 * props e rispetta CHECK 6B/6C (orchestrator non aggiunge `useSyncExternalStore`).
 */

import React from 'react';
import type { RibbonCommandsApi } from '../ui/ribbon/context/RibbonCommandContext';
import type { RibbonTab } from '../ui/ribbon/types/ribbon-types';
import type { SceneModel } from '../types/scene';
import type { useLevels } from '../systems/levels';
import { RibbonRoot } from '../ui/ribbon/components/RibbonRoot';
import { StairAdvancedPanelHost } from './StairAdvancedPanelHost';

type LevelManager = ReturnType<typeof useLevels>;

export interface DxfViewerTopBarProps {
  readonly ribbonCommands: RibbonCommandsApi;
  readonly contextualTabs: readonly RibbonTab[];
  readonly activeContextualTrigger: string | null;
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManager;
}

export function DxfViewerTopBar({
  ribbonCommands,
  contextualTabs,
  activeContextualTrigger,
  primarySelectedId,
  currentScene,
  levelManager,
}: DxfViewerTopBarProps) {
  return (
    <>
      <RibbonRoot
        commands={ribbonCommands}
        contextualTabs={contextualTabs}
        activeContextualTrigger={activeContextualTrigger}
      />
      {/*
        ADR-358 Phase 8 sidebar dock (2026-05-17) — Stair properties moved
        from a right-floating overlay into the left sidebar as the third
        "Properties" tab (industry pattern: VS Code Side Bar / ArchiCAD
        Tray / Revit dockable palettes). The right-floating host is
        disabled to free the canvas right side; flip the conditional back
        on if a future option wants both surfaces.
      */}
      {false && (
        <StairAdvancedPanelHost
          primarySelectedId={primarySelectedId}
          currentScene={currentScene}
          levelManager={levelManager}
          projectId={levelManager.saveContext?.projectId ?? undefined}
          floorplanId={levelManager.fileRecordId ?? undefined}
        />
      )}
    </>
  );
}
