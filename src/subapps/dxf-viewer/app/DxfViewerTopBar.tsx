'use client';

/**
 * ADR-358 Phase 8 size-extract — top-bar wrapper estratto da `DxfViewerContent`
 * per rispettare N.7.1 (max 500 righe / file). Raggruppa il `RibbonRoot` con
 * gli always-on BIM persistence hosts (Wall/Opening/Slab/Column/Beam/SlabOpening/
 * Stair) + ausiliari (SlabOpeningStack/PsetEditor/IfcExport). Deriva qui i campi
 * di scope `projectId` / `floorplanId` dal `levelManager` (Phase 8 reactive
 * mirrors).
 *
 * 2026-05-27 — `StairAdvancedPanelHost` rimosso (era gated `{false && ...}`
 * dal sidebar dock 2026-05-17); il suo `useStairPersistence` lifecycle è
 * stato spostato dentro `StairPersistenceHost` always-on per parità con gli
 * altri sei BIM hosts e per chiudere il bug "stair drawn ma non saved in
 * `floorplan_stairs`".
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
import { WallPersistenceHost } from './WallPersistenceHost';
import { OpeningPersistenceHost } from './OpeningPersistenceHost';
import { SlabPersistenceHost } from './SlabPersistenceHost';
import { ColumnPersistenceHost } from './ColumnPersistenceHost';
import { BeamPersistenceHost } from './BeamPersistenceHost';
import { SlabOpeningPersistenceHost } from './SlabOpeningPersistenceHost';
import { StairPersistenceHost } from './StairPersistenceHost';
import { SlabOpeningStackHost } from './SlabOpeningStackHost';
import { PsetEditorHost } from './PsetEditorHost';
import { IfcExportHost } from './IfcExportHost';

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
      <WallPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <OpeningPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <SlabPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <ColumnPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <BeamPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <SlabOpeningPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
        buildingId={levelManager.saveContext?.buildingId ?? undefined}
      />
      <SlabOpeningStackHost levelManager={levelManager} />
      <StairPersistenceHost
        primarySelectedId={primarySelectedId}
        currentScene={currentScene}
        levelManager={levelManager}
        projectId={levelManager.saveContext?.projectId ?? undefined}
        floorplanId={levelManager.fileRecordId ?? undefined}
      />
      <PsetEditorHost levelManager={levelManager} />
      <IfcExportHost />
    </>
  );
}
